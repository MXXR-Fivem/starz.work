import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import pool from "../../config/database";
import { toIsoDateOrNull, toIsoDateOrNow } from "../../helpers/date";
import { parsePositiveInteger } from "../../helpers/env";
import createHttpError from "../../helpers/httpError";
import sendEmail from "../../helpers/mailer";
import { roundTo, toPercent } from "../../helpers/number";
import { buildPagination } from "../../helpers/pagination";
import { normalizeEmail } from "../../helpers/string";
import withTransaction from "../../helpers/transaction";
import { assertUploadSignature } from "../../helpers/upload";
import type { ApplicationStatus } from "../applications/applications.schemas";
import { getUserById } from "../users/users.repository";
import notificationsService from "../notifications/notifications.service";
import offersService from "../offers/offers.service";
import type {
	CompanyApplicationStatusPayload,
	CompanyApplicationsQuery,
	CompanyOffersQuery,
	CreateCompanyOfferPayload,
	CreateCompanyPayload,
	InviteMemberPayload,
	UpdateCompanyOfferPayload,
	UpdateCompanyPayload
} from "./company.schemas";

interface CompanyRow extends RowDataPacket {
	id: number;
	name: string;
	slug: string | null;
	website_url: string | null;
	description: string | null;
	logo_url: string | null;
	created_at: Date | string;
	updated_at: Date | string;
}

interface CompanyAccessRow extends RowDataPacket {
	orga_id: number | null;
	company_role: "owner" | "member" | null;
	role_name: string | null;
}

interface MemberRow extends RowDataPacket {
	id: number;
	firstname: string;
	lastname: string;
	email: string | null;
	company_role: "owner" | "member" | null;
	status: "en_recherche" | "recruteur";
	profile_photo_url: string | null;
	created_at: Date | string;
}

interface InvitationRow extends RowDataPacket {
	id: number;
	company_id: number;
	company_name: string;
	email: string;
	status: "pending" | "accepted" | "declined" | "cancelled";
	invited_by_user_id: number;
	invited_by_firstname: string;
	invited_by_lastname: string;
	created_at: Date | string;
	updated_at: Date | string;
}

interface CompanyOfferRow extends RowDataPacket {
	id: number;
	title: string;
	description_preview: string | null;
	location: string | null;
	contract_type: string | null;
	remote_policy: string | null;
	status: "draft" | "published" | "closed";
	moderation_status: "approved" | "rejected";
	premium: number;
	views_count: number;
	published_at: Date | string | null;
	expires_at: Date | string | null;
	created_at: Date | string;
	updated_at: Date | string;
	applications_count: number;
}

interface CompanyApplicationRow extends RowDataPacket {
	id: number;
	status: ApplicationStatus;
	cover_letter: string | null;
	resume_url: string | null;
	applied_at: Date | string;
	created_at: Date | string;
	updated_at: Date | string;
	applicant_id: number;
	firstname: string;
	lastname: string;
	email: string | null;
	profile_photo_url: string | null;
	offer_id: number;
	offer_title: string;
}

interface ApplicationNotificationRow extends RowDataPacket {
	user_id: number;
	offer_id: number;
	offer_title: string;
	company_name: string;
}

interface ApplicationAcceptanceEmailRow extends RowDataPacket {
	status: ApplicationStatus;
	company_id: number;
	applicant_email: string | null;
	applicant_firstname: string;
	applicant_lastname: string;
	accepted_by_email: string | null;
	accepted_by_firstname: string;
	accepted_by_lastname: string;
	offer_title: string;
	company_name: string;
}

interface CompanyDataSummaryRow extends RowDataPacket {
	total_offers_count: number;
	active_offers_count: number;
	disabled_offers_count: number;
	applications_count: number;
	pending_review_count: number;
	accepted_count: number;
	rejected_count: number;
	expiring_soon_count: number;
	avg_processing_hours: number | null;
}

interface CompanyOfferPerformanceRow extends RowDataPacket {
	offer_id: number;
	title: string;
	premium: number;
	status: "draft" | "published" | "closed";
	applications_count: number;
	reviewed_count: number;
	accepted_count: number;
	rejected_count: number;
}

interface CompanyMemberEmailRow extends RowDataPacket {
	email: string | null;
}

interface CompanyPremiumPerformanceRow extends RowDataPacket {
	premium: number;
	offers_count: number;
	applications_count: number;
	accepted_count: number;
}

interface CompanyActivityRow extends RowDataPacket {
	type: "application" | "offer";
	title: string;
	description: string;
	created_at: Date | string;
	age_seconds: number;
}

interface CountRow extends RowDataPacket {
	total: number;
}

interface SaveCompanyLogoPayload {
	userId: number;
	buffer: Buffer;
	contentType?: string;
	originalName?: string;
}

const INVITATION_SELECT = `
	SELECT
		ci.id,
		ci.company_id,
		c.name AS company_name,
		ci.email,
		ci.status,
		ci.invited_by_user_id,
		u.firstname AS invited_by_firstname,
		u.lastname AS invited_by_lastname,
		ci.created_at,
		ci.updated_at
	FROM company_invitations ci
	INNER JOIN companies c ON c.id = ci.company_id
	INNER JOIN users u ON u.id = ci.invited_by_user_id
`;

const COMPANY_APPLICATION_SELECT = `
	SELECT
		a.id,
		a.status,
		a.cover_letter,
		a.resume_url,
		a.applied_at,
		a.created_at,
		a.updated_at,
		u.id AS applicant_id,
		u.firstname,
		u.lastname,
		u.email,
		u.profile_photo_url,
		o.id AS offer_id,
		o.title AS offer_title
	FROM applications a
	INNER JOIN users u ON u.id = a.user_id
	INNER JOIN offers o ON o.id = a.offer_id
`;

const slugify = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 255);

const mapCompany = (row: CompanyRow, role?: "owner" | "member" | null) => ({
	id: row.id,
	name: row.name,
	slug: row.slug,
	websiteUrl: row.website_url,
	description: row.description,
	logoUrl: row.logo_url,
	role: role ?? null,
	createdAt: toIsoDateOrNow(row.created_at),
	updatedAt: toIsoDateOrNow(row.updated_at)
});

const getCompanyById = async (companyId: number): Promise<CompanyRow | null> => {
	const [rows] = await pool.query<CompanyRow[]>(
		`
			SELECT id, name, slug, website_url, description, logo_url, created_at, updated_at
			FROM companies
			WHERE id = ?
			LIMIT 1
		`,
		[companyId]
	);
	return rows[0] ?? null;
};

const getAccess = async (userId: number): Promise<CompanyAccessRow> => {
	const [rows] = await pool.query<CompanyAccessRow[]>(
		`
			SELECT
				u.orga_id,
				u.company_role,
				r.name AS role_name
			FROM users u
			LEFT JOIN roles r ON r.id = u.role_id
			WHERE u.id = ?
			LIMIT 1
		`,
		[userId]
	);
	const access = rows[0];

	if (!access) {
		throw createHttpError(401, "Unauthorized");
	}

	return access;
};

const requireCompanyMember = async (userId: number): Promise<CompanyAccessRow & { orga_id: number }> => {
	const access = await getAccess(userId);

	if (!access.orga_id) {
		throw createHttpError(403, "User does not belong to a company");
	}

	return access as CompanyAccessRow & { orga_id: number };
};

const requireCompanyOwner = async (userId: number): Promise<CompanyAccessRow & { orga_id: number }> => {
	const access = await requireCompanyMember(userId);

	if (access.company_role !== "owner" && access.role_name !== "admin") {
		throw createHttpError(403, "Company owner role is required");
	}

	return access;
};

const assertOfferBelongsToCompany = async (offerId: number, companyId: number): Promise<void> => {
	const [rows] = await pool.query<RowDataPacket[]>(
		"SELECT id FROM offers WHERE id = ? AND company_id = ? LIMIT 1",
		[offerId, companyId]
	);

	if (!rows[0]) {
		throw createHttpError(404, "Offer not found");
	}
};

const buildUniqueSlug = async (name: string, ignoredCompanyId?: number): Promise<string> => {
	const baseSlug = slugify(name) || `company-${Date.now()}`;
	let slug = baseSlug;
	let suffix = 1;

	while (true) {
		const [rows] = await pool.query<RowDataPacket[]>(
			"SELECT id FROM companies WHERE slug = ? AND (? IS NULL OR id <> ?) LIMIT 1",
			[slug, ignoredCompanyId ?? null, ignoredCompanyId ?? null]
		);

		if (!rows[0]) {
			return slug;
		}

		suffix += 1;
		slug = `${baseSlug.slice(0, 240)}-${suffix}`;
	}
};

const getLogoExtension = (contentType?: string, originalName?: string): string | null => {
	const byMime: Record<string, string> = {
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/webp": "webp"
	};

	if (contentType && byMime[contentType]) {
		return byMime[contentType];
	}

	const ext = originalName ? path.extname(originalName).slice(1).toLowerCase() : "";
	return ext || null;
};

const assertAllowedLogo = (
	buffer: Buffer,
	contentType?: string,
	originalName?: string
): string => {
	const extension = getLogoExtension(contentType, originalName);
	const maxSize = parsePositiveInteger(process.env.COMPANY_LOGO_MAX_BYTES, 5 * 1024 * 1024);

	if (buffer.length === 0) {
		throw createHttpError(400, "Uploaded file is empty");
	}

	if (buffer.length > maxSize) {
		throw createHttpError(413, "Uploaded file is too large");
	}

	if (!extension || !["jpg", "jpeg", "png", "webp"].includes(extension)) {
		throw createHttpError(400, "Unsupported file type");
	}

	const normalizedExtension = extension === "jpeg" ? "jpg" : extension;
	assertUploadSignature(buffer, normalizedExtension, "image");

	return normalizedExtension;
};

const mapInvitation = (row: InvitationRow) => ({
	id: row.id,
	companyId: row.company_id,
	companyName: row.company_name,
	email: row.email,
	status: row.status,
	invitedBy: {
		id: row.invited_by_user_id,
		firstName: row.invited_by_firstname,
		lastName: row.invited_by_lastname
	},
	createdAt: toIsoDateOrNow(row.created_at),
	updatedAt: toIsoDateOrNow(row.updated_at)
});

const mapOffer = (row: CompanyOfferRow) => ({
	id: row.id,
	title: row.title,
	descriptionPreview: row.description_preview,
	location: row.location,
	contractType: row.contract_type,
	remotePolicy: row.remote_policy,
	status: row.status,
	moderationStatus: row.moderation_status,
	premium: row.premium === 1,
	viewsCount: Number(row.views_count ?? 0),
	publishedAt: toIsoDateOrNull(row.published_at),
	expiresAt: toIsoDateOrNull(row.expires_at),
	createdAt: toIsoDateOrNow(row.created_at),
	updatedAt: toIsoDateOrNow(row.updated_at),
	applicationsCount: Number(row.applications_count ?? 0)
});

const applicationStatusLabel: Record<ApplicationStatus, string> = {
	draft: "Brouillon",
	submitted: "Envoyée",
	viewed: "En cours d'examen",
	accepted: "Acceptée",
	rejected: "Refusée",
	withdrawn: "Retirée"
};

const mapApplication = (row: CompanyApplicationRow) => ({
	id: row.id,
	status: row.status,
	statusLabel: applicationStatusLabel[row.status],
	coverLetter: row.cover_letter,
	resumeUrl: row.resume_url,
	appliedAt: toIsoDateOrNow(row.applied_at),
	createdAt: toIsoDateOrNow(row.created_at),
	updatedAt: toIsoDateOrNow(row.updated_at),
	applicant: {
		id: row.applicant_id,
		firstName: row.firstname,
		lastName: row.lastname,
		email: row.email,
		profilePhotoUrl: row.profile_photo_url
	},
	offer: {
		id: row.offer_id,
		title: row.offer_title
	}
});

const notifyApplicationUpdate = async (applicationId: number, offerId: number): Promise<void> => {
	const [rows] = await pool.query<ApplicationNotificationRow[]>(
		`
			SELECT
				a.user_id,
				o.id AS offer_id,
				o.title AS offer_title,
				c.name AS company_name
			FROM applications a
			INNER JOIN offers o ON o.id = a.offer_id
			INNER JOIN companies c ON c.id = o.company_id
			WHERE a.id = ? AND a.offer_id = ?
			LIMIT 1
		`,
		[applicationId, offerId]
	);
	const notificationData = rows[0];

	if (!notificationData) {
		return;
	}

	await notificationsService.createNotification({
		userId: notificationData.user_id,
		event: "application_update",
		eventData: {
			offer_id: notificationData.offer_id,
			company_name: notificationData.company_name,
			offer_title: notificationData.offer_title
		}
	});
};

const getApplicationAcceptanceEmailData = async (
	applicationId: number,
	offerId: number,
	acceptedByUserId: number
): Promise<ApplicationAcceptanceEmailRow | null> => {
	const [rows] = await pool.query<ApplicationAcceptanceEmailRow[]>(
		`
			SELECT
				a.status,
				c.id AS company_id,
				applicant.email AS applicant_email,
				applicant.firstname AS applicant_firstname,
				applicant.lastname AS applicant_lastname,
				accepted_by.email AS accepted_by_email,
				accepted_by.firstname AS accepted_by_firstname,
				accepted_by.lastname AS accepted_by_lastname,
				o.title AS offer_title,
				c.name AS company_name
			FROM applications a
			INNER JOIN users applicant ON applicant.id = a.user_id
			INNER JOIN users accepted_by ON accepted_by.id = ?
			INNER JOIN offers o ON o.id = a.offer_id
			INNER JOIN companies c ON c.id = o.company_id
			WHERE a.id = ? AND a.offer_id = ?
			LIMIT 1
		`,
		[acceptedByUserId, applicationId, offerId]
	);

	return rows[0] ?? null;
};

const getCompanyMemberEmails = async (companyId: number): Promise<string[]> => {
	const [rows] = await pool.query<CompanyMemberEmailRow[]>(
		`
			SELECT email
			FROM users
			WHERE orga_id = ? AND email IS NOT NULL
			ORDER BY company_role = 'owner' DESC, id ASC
		`,
		[companyId]
	);

	return rows.map((row) => row.email).filter((email): email is string => Boolean(email));
};

const sendApplicationAcceptedEmail = async (
	applicationId: number,
	offerId: number,
	acceptedByUserId: number
): Promise<void> => {
	const emailData = await getApplicationAcceptanceEmailData(
		applicationId,
		offerId,
		acceptedByUserId
	);

	if (!emailData?.applicant_email) {
		return;
	}

	const applicantName = `${emailData.applicant_firstname} ${emailData.applicant_lastname}`.trim();
	const acceptedByName = `${emailData.accepted_by_firstname} ${emailData.accepted_by_lastname}`.trim();
	const applicantEmail = emailData.applicant_email.toLowerCase();
	const companyMemberEmails = (await getCompanyMemberEmails(emailData.company_id))
		.filter((email) => email.toLowerCase() !== applicantEmail);

	try {
		await sendEmail({
			to: emailData.applicant_email,
			cc: companyMemberEmails.length > 0 ? companyMemberEmails : undefined,
			subject: `Candidature acceptée - ${emailData.offer_title}`,
			text: [
				`Bonjour ${applicantName || "candidat"},`,
				"",
				`Bonne nouvelle, votre candidature pour l'offre "${emailData.offer_title}" chez ${emailData.company_name} a été acceptée.`,
				acceptedByName
					? `Cette decision a été prise par ${acceptedByName}.`
					: "L'equipe de recrutement reviendra vers vous prochainement.",
				"",
				"L'equipe Starz"
			].join("\n")
		});
	} catch (error) {
		console.warn("[company] Failed to send application acceptance email", error);
	}
};

export const getCompany = async (userId: number) => {
	const access = await requireCompanyMember(userId);
	const company = await getCompanyById(access.orga_id);

	if (!company) {
		throw createHttpError(404, "Company not found");
	}

	return { company: mapCompany(company, access.company_role) };
};

export const getCompanyData = async (userId: number) => {
	const access = await requireCompanyMember(userId);

	const [summaryResult, offerPerformanceResult, premiumPerformanceResult] = await Promise.all([
		pool.query<CompanyDataSummaryRow[]>(
			`
				SELECT
					COUNT(DISTINCT o.id) AS total_offers_count,
					COUNT(DISTINCT CASE
						WHEN o.status = 'published'
							AND o.moderation_status = 'approved'
							AND (o.expires_at IS NULL OR o.expires_at >= NOW())
						THEN o.id
					END) AS active_offers_count,
					COUNT(DISTINCT CASE WHEN o.status = 'closed' THEN o.id END) AS disabled_offers_count,
					COUNT(a.id) AS applications_count,
					SUM(CASE WHEN a.status IN ('submitted', 'viewed') THEN 1 ELSE 0 END) AS pending_review_count,
					SUM(CASE WHEN a.status = 'accepted' THEN 1 ELSE 0 END) AS accepted_count,
					SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count,
					COUNT(DISTINCT CASE
						WHEN o.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 14 DAY)
						THEN o.id
					END) AS expiring_soon_count,
					AVG(CASE
						WHEN a.status IN ('accepted', 'rejected')
						THEN TIMESTAMPDIFF(HOUR, a.applied_at, a.updated_at)
					END) AS avg_processing_hours
				FROM offers o
				LEFT JOIN applications a ON a.offer_id = o.id
				WHERE o.company_id = ?
			`,
			[access.orga_id]
		),
		pool.query<CompanyOfferPerformanceRow[]>(
			`
				SELECT
					o.id AS offer_id,
					o.title,
					o.premium,
					o.status,
					COUNT(a.id) AS applications_count,
					SUM(CASE WHEN a.status IN ('viewed', 'accepted', 'rejected') THEN 1 ELSE 0 END) AS reviewed_count,
					SUM(CASE WHEN a.status = 'accepted' THEN 1 ELSE 0 END) AS accepted_count,
					SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count
				FROM offers o
				LEFT JOIN applications a ON a.offer_id = o.id
				WHERE o.company_id = ?
				GROUP BY o.id
				ORDER BY applications_count DESC, o.updated_at DESC, o.id DESC
				LIMIT 10
			`,
			[access.orga_id]
		),
		pool.query<CompanyPremiumPerformanceRow[]>(
			`
				SELECT
					o.premium,
					COUNT(DISTINCT o.id) AS offers_count,
					COUNT(a.id) AS applications_count,
					SUM(CASE WHEN a.status = 'accepted' THEN 1 ELSE 0 END) AS accepted_count
				FROM offers o
				LEFT JOIN applications a ON a.offer_id = o.id
				WHERE o.company_id = ?
				GROUP BY o.premium
				ORDER BY o.premium DESC
			`,
			[access.orga_id]
		)
	]);
	const summary = summaryResult[0][0];
	const applicationsCount = Number(summary?.applications_count ?? 0);
	const acceptedCount = Number(summary?.accepted_count ?? 0);
	const rejectedCount = Number(summary?.rejected_count ?? 0);

	return {
		summary: {
			totalOffersCount: Number(summary?.total_offers_count ?? 0),
			activeOffersCount: Number(summary?.active_offers_count ?? 0),
			disabledOffersCount: Number(summary?.disabled_offers_count ?? 0),
			applicationsCount,
			pendingReviewApplicationsCount: Number(summary?.pending_review_count ?? 0),
			acceptedApplicationsCount: acceptedCount,
			rejectedApplicationsCount: rejectedCount,
			expiringSoonOffersCount: Number(summary?.expiring_soon_count ?? 0),
			applicationAcceptanceRate: toPercent(acceptedCount, applicationsCount),
			applicationRejectionRate: toPercent(rejectedCount, applicationsCount),
			averageApplicationProcessingHours:
				summary?.avg_processing_hours === null || summary?.avg_processing_hours === undefined
					? null
					: roundTo(Number(summary.avg_processing_hours))
		},
		offerPerformance: offerPerformanceResult[0].map((row) => {
			const offerApplicationsCount = Number(row.applications_count ?? 0);
			const offerAcceptedCount = Number(row.accepted_count ?? 0);
			const offerRejectedCount = Number(row.rejected_count ?? 0);

			return {
				offerId: row.offer_id,
				title: row.title,
				premium: row.premium === 1,
				status: row.status,
				applicationsCount: offerApplicationsCount,
				reviewedApplicationsCount: Number(row.reviewed_count ?? 0),
				acceptedApplicationsCount: offerAcceptedCount,
				rejectedApplicationsCount: offerRejectedCount,
				acceptanceRate: toPercent(offerAcceptedCount, offerApplicationsCount),
				rejectionRate: toPercent(offerRejectedCount, offerApplicationsCount)
			};
		}),
		premiumPerformance: premiumPerformanceResult[0].map((row) => {
			const segmentApplicationsCount = Number(row.applications_count ?? 0);
			const segmentAcceptedCount = Number(row.accepted_count ?? 0);

			return {
				type: row.premium === 1 ? "premium" : "standard",
				offersCount: Number(row.offers_count ?? 0),
				applicationsCount: segmentApplicationsCount,
				acceptedApplicationsCount: segmentAcceptedCount,
				acceptanceRate: toPercent(segmentAcceptedCount, segmentApplicationsCount)
			};
		})
	};
};

export const createCompany = async (userId: number, payload: CreateCompanyPayload) => {
	const user = await getUserById(userId);

	if (!user) {
		throw createHttpError(401, "Unauthorized");
	}

	if (user.orga_id) {
		throw createHttpError(409, "User already belongs to a company");
	}

	const slug = await buildUniqueSlug(payload.name);

	const companyId = await withTransaction(async (connection) => {
		const [insertResult] = await connection.query<ResultSetHeader>(
			`
				INSERT INTO companies (name, slug, website_url, description, logo_url)
				VALUES (?, ?, ?, ?, ?)
			`,
			[
				payload.name,
				slug,
				payload.websiteUrl ?? null,
				payload.description ?? null,
				payload.logoUrl ?? null
			]
		);
		const createdCompanyId = Number(insertResult.insertId);

		await connection.query<ResultSetHeader>(
			"UPDATE users SET orga_id = ?, company_role = 'owner', status = 'recruteur' WHERE id = ?",
			[createdCompanyId, userId]
		);

		return createdCompanyId;
	});

	const company = await getCompanyById(companyId);

	if (!company) {
		throw createHttpError(500, "Failed to load created company");
	}

	return { company: mapCompany(company, "owner") };
};

export const updateCompany = async (userId: number, payload: UpdateCompanyPayload) => {
	const access = await requireCompanyOwner(userId);
	const updateFields: string[] = [];
	const updateValues: unknown[] = [];

	if (payload.name !== undefined) {
		updateFields.push("name = ?", "slug = ?");
		updateValues.push(payload.name, await buildUniqueSlug(payload.name, access.orga_id));
	}
	if (payload.websiteUrl !== undefined) {
		updateFields.push("website_url = ?");
		updateValues.push(payload.websiteUrl);
	}
	if (payload.description !== undefined) {
		updateFields.push("description = ?");
		updateValues.push(payload.description);
	}
	if (payload.logoUrl !== undefined) {
		updateFields.push("logo_url = ?");
		updateValues.push(payload.logoUrl);
	}

	await pool.query<ResultSetHeader>(
		`UPDATE companies SET ${updateFields.join(", ")} WHERE id = ?`,
		[...updateValues, access.orga_id]
	);

	return getCompany(userId);
};

export const saveCompanyLogo = async ({
	userId,
	buffer,
	contentType,
	originalName
}: SaveCompanyLogoPayload) => {
	const access = await requireCompanyOwner(userId);
	const extension = assertAllowedLogo(buffer, contentType, originalName);
	const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");
	const relativeDirectory = path.join("companies", String(access.orga_id));
	const targetDirectory = path.join(uploadRoot, relativeDirectory);
	const filename = `logo-${Date.now()}-${randomUUID()}.${extension}`;
	const relativePath = path.join(relativeDirectory, filename);
	const publicUrl = `/uploads/${relativePath.split(path.sep).join("/")}`;

	await fs.mkdir(targetDirectory, { recursive: true });
	await fs.writeFile(path.join(uploadRoot, relativePath), buffer);

	await pool.query<ResultSetHeader>("UPDATE companies SET logo_url = ? WHERE id = ?", [
		publicUrl,
		access.orga_id
	]);

	return getCompany(userId);
};

export const listMembers = async (userId: number) => {
	const access = await requireCompanyMember(userId);
	const [rows] = await pool.query<MemberRow[]>(
		`
			SELECT id, firstname, lastname, email, company_role, status, profile_photo_url, created_at
			FROM users
			WHERE orga_id = ?
			ORDER BY company_role ASC, firstname ASC, lastname ASC
		`,
		[access.orga_id]
	);

	return {
		members: rows.map((row) => ({
			id: row.id,
			firstName: row.firstname,
			lastName: row.lastname,
			email: row.email,
			companyRole: row.company_role,
			status: row.status,
			profilePhotoUrl: row.profile_photo_url,
			createdAt: toIsoDateOrNow(row.created_at)
		}))
	};
};

export const listActivity = async (userId: number) => {
	const access = await requireCompanyMember(userId);
	const [rows] = await pool.query<CompanyActivityRow[]>(
		`
			(
				SELECT
					'application' AS type,
					o.title,
					CONCAT(u.firstname, ' ', u.lastname, ' a postule') AS description,
					a.applied_at AS created_at,
					TIMESTAMPDIFF(SECOND, a.applied_at, NOW()) AS age_seconds
				FROM applications a
				INNER JOIN offers o ON o.id = a.offer_id
				INNER JOIN users u ON u.id = a.user_id
				WHERE o.company_id = ?
				ORDER BY a.applied_at DESC
				LIMIT 5
			)
			UNION ALL
			(
				SELECT
					'offer' AS type,
					o.title,
					CASE
						WHEN ABS(TIMESTAMPDIFF(SECOND, o.created_at, o.updated_at)) <= 5 THEN 'Offre créée'
						WHEN o.status = 'closed' THEN 'Offre desactivee'
						WHEN o.status = 'published' THEN 'Offre mise a jour'
						ELSE 'Offre en brouillon'
					END AS description,
					CASE
						WHEN ABS(TIMESTAMPDIFF(SECOND, o.created_at, o.updated_at)) <= 5 THEN o.created_at
						ELSE o.updated_at
					END AS created_at,
					TIMESTAMPDIFF(
						SECOND,
						CASE
							WHEN ABS(TIMESTAMPDIFF(SECOND, o.created_at, o.updated_at)) <= 5 THEN o.created_at
							ELSE o.updated_at
						END,
						NOW()
					) AS age_seconds
				FROM offers o
				WHERE o.company_id = ?
				ORDER BY o.updated_at DESC
				LIMIT 5
			)
			ORDER BY created_at DESC
			LIMIT 8
		`,
		[access.orga_id, access.orga_id]
	);

	return {
		activity: rows.map((row) => ({
			type: row.type,
			title: row.title,
			description: row.description,
			createdAt: toIsoDateOrNow(row.created_at),
			ageSeconds: Math.max(0, Number(row.age_seconds ?? 0))
		}))
	};
};

export const inviteMember = async (userId: number, payload: InviteMemberPayload) => {
	const access = await requireCompanyOwner(userId);
	const email = normalizeEmail(payload.email);
	const company = await getCompanyById(access.orga_id);
	const [invitedRows] = await pool.query<(RowDataPacket & { id: number; orga_id: number | null })[]>(
		"SELECT id, orga_id FROM users WHERE email = ? LIMIT 1",
		[email]
	);
	const existingUser = invitedRows[0];

	if (existingUser?.orga_id) {
		throw createHttpError(409, "User already belongs to a company");
	}

	const [pendingRows] = await pool.query<RowDataPacket[]>(
		`
			SELECT id
			FROM company_invitations
			WHERE company_id = ? AND email = ? AND status = 'pending'
			LIMIT 1
		`,
		[access.orga_id, email]
	);

	if (pendingRows[0]) {
		throw createHttpError(409, "Invitation is already pending");
	}

	const [insertResult] = await pool.query<ResultSetHeader>(
		`
			INSERT INTO company_invitations (company_id, email, invited_by_user_id)
			VALUES (?, ?, ?)
		`,
		[access.orga_id, email, userId]
	);

	if (existingUser && company) {
		await notificationsService.createNotification({
			userId: existingUser.id,
			event: "company_invite",
			eventData: {
				company_id: access.orga_id,
				company_name: company.name
			}
		});
	}

	return getInvitationById(Number(insertResult.insertId));
};

const getInvitationById = async (invitationId: number) => {
	const [rows] = await pool.query<InvitationRow[]>(
		`
			${INVITATION_SELECT}
			WHERE ci.id = ?
			LIMIT 1
		`,
		[invitationId]
	);
	const invitation = rows[0];

	if (!invitation) {
		throw createHttpError(404, "Invitation not found");
	}

	return { invitation: mapInvitation(invitation) };
};

export const listInvitations = async (userId: number) => {
	const user = await getUserById(userId);

	if (!user?.email) {
		return { invitations: [] };
	}

	const [rows] = await pool.query<InvitationRow[]>(
		`
			${INVITATION_SELECT}
			WHERE ci.email = ? AND ci.status = 'pending'
			ORDER BY ci.created_at DESC
		`,
		[normalizeEmail(user.email)]
	);

	return { invitations: rows.map(mapInvitation) };
};

const respondToInvitation = async (
	userId: number,
	invitationId: number,
	status: "accepted" | "declined"
) => {
	const user = await getUserById(userId);

	if (!user?.email) {
		throw createHttpError(403, "User has no email address");
	}
	const userEmail = normalizeEmail(user.email);

	const [rows] = await pool.query<InvitationRow[]>(
		`
			${INVITATION_SELECT}
			WHERE ci.id = ? AND ci.email = ? AND ci.status = 'pending'
			LIMIT 1
		`,
		[invitationId, userEmail]
	);
	const invitation = rows[0];

	if (!invitation) {
		throw createHttpError(404, "Invitation not found");
	}

	if (status === "accepted" && user.orga_id) {
		throw createHttpError(409, "User already belongs to a company");
	}

	await withTransaction(async (connection) => {
		await connection.query<ResultSetHeader>(
			"UPDATE company_invitations SET status = ?, responded_at = ? WHERE id = ?",
			[status, new Date(), invitationId]
		);

		if (status === "accepted") {
			await connection.query<ResultSetHeader>(
				"UPDATE users SET orga_id = ?, company_role = 'member', status = 'recruteur' WHERE id = ?",
				[invitation.company_id, userId]
			);
			await connection.query<ResultSetHeader>(
				`
					UPDATE company_invitations
					SET status = 'cancelled', responded_at = ?
					WHERE email = ? AND status = 'pending' AND id <> ?
				`,
				[new Date(), userEmail, invitationId]
			);
		}
	});

	return getInvitationById(invitationId);
};

export const acceptInvitation = (userId: number, invitationId: number) =>
	respondToInvitation(userId, invitationId, "accepted");

export const declineInvitation = (userId: number, invitationId: number) =>
	respondToInvitation(userId, invitationId, "declined");

export const kickMember = async (userId: number, targetUserId: number): Promise<void> => {
	const access = await requireCompanyOwner(userId);
	const target = await getUserById(targetUserId);

	if (!target || target.orga_id !== access.orga_id) {
		throw createHttpError(404, "Member not found");
	}

	if (target.company_role === "owner") {
		throw createHttpError(403, "Cannot kick a company owner");
	}

	await pool.query<ResultSetHeader>(
		"UPDATE users SET orga_id = NULL, company_role = NULL WHERE id = ?",
		[targetUserId]
	);
};

export const leaveCompany = async (userId: number): Promise<void> => {
	const access = await requireCompanyMember(userId);

	if (access.company_role === "owner") {
		const [ownerRows] = await pool.query<CountRow[]>(
			"SELECT COUNT(*) AS total FROM users WHERE orga_id = ? AND company_role = 'owner'",
			[access.orga_id]
		);
		const ownersCount = Number(ownerRows[0]?.total ?? 0);

		if (ownersCount <= 1) {
			throw createHttpError(403, "Cannot leave company as the only owner");
		}
	}

	await pool.query<ResultSetHeader>(
		"UPDATE users SET orga_id = NULL, company_role = NULL WHERE id = ?",
		[userId]
	);
};

export const listOffers = async (userId: number, query: CompanyOffersQuery) => {
	const access = await requireCompanyMember(userId);
	const whereClauses = ["o.company_id = ?"];
	const params: unknown[] = [access.orga_id];

	if (query.status) {
		whereClauses.push("o.status = ?");
		params.push(query.status);
	}

	if (query.q) {
		const search = `%${query.q}%`;
		whereClauses.push("(o.title LIKE ? OR o.description_preview LIKE ? OR o.location LIKE ? OR o.contract_type LIKE ? OR o.remote_policy LIKE ?)");
		params.push(search, search, search, search, search);
	}

	const whereSql = `WHERE ${whereClauses.join(" AND ")}`;
	const [countRows] = await pool.query<CountRow[]>(
		`SELECT COUNT(*) AS total FROM offers o ${whereSql}`,
		params
	);
	const total = Number(countRows[0]?.total ?? 0);

	const [rows] = await pool.query<CompanyOfferRow[]>(
		`
			SELECT
				o.id,
				o.title,
				o.description_preview,
				o.location,
				o.contract_type,
				o.remote_policy,
				o.status,
				o.moderation_status,
				o.premium,
				o.views_count,
				o.published_at,
				o.expires_at,
				o.created_at,
				o.updated_at,
				COUNT(a.id) AS applications_count
			FROM offers o
			LEFT JOIN applications a ON a.offer_id = o.id
			${whereSql}
			GROUP BY o.id
			ORDER BY o.updated_at DESC, o.id DESC
			LIMIT ? OFFSET ?
		`,
		[...params, query.size, query.page * query.size]
	);

	return {
		items: rows.map(mapOffer),
		pagination: buildPagination(query, total)
	};
};

export const createOffer = async (userId: number, payload: CreateCompanyOfferPayload) => {
	const access = await requireCompanyOwner(userId);
	const offer = await offersService.createOffer(userId, {
		...payload,
		companyId: access.orga_id
	});

	return { offer };
};

export const updateOffer = async (
	userId: number,
	offerId: number,
	payload: UpdateCompanyOfferPayload
) => ({ offer: await offersService.updateOffer(userId, offerId, payload) });

export const closeOffer = async (userId: number, offerId: number) => ({
	offer: await offersService.closeOffer(userId, offerId)
});

export const listOfferApplications = async (
	userId: number,
	offerId: number,
	query: CompanyApplicationsQuery
) => {
	const access = await requireCompanyMember(userId);
	await assertOfferBelongsToCompany(offerId, access.orga_id);

	const whereClauses = ["a.offer_id = ?"];
	const params: unknown[] = [offerId];

	if (query.status) {
		whereClauses.push("a.status = ?");
		params.push(query.status);
	}

	const whereSql = `WHERE ${whereClauses.join(" AND ")}`;
	const [countRows] = await pool.query<CountRow[]>(
		`SELECT COUNT(*) AS total FROM applications a ${whereSql}`,
		params
	);
	const total = Number(countRows[0]?.total ?? 0);

	const [rows] = await pool.query<CompanyApplicationRow[]>(
		`
			${COMPANY_APPLICATION_SELECT}
			${whereSql}
			ORDER BY a.applied_at DESC, a.id DESC
			LIMIT ? OFFSET ?
		`,
		[...params, query.size, query.page * query.size]
	);

	return {
		items: rows.map(mapApplication),
		pagination: buildPagination(query, total)
	};
};

export const getOfferApplication = async (
	userId: number,
	offerId: number,
	applicationId: number
) => {
	const access = await requireCompanyMember(userId);
	await assertOfferBelongsToCompany(offerId, access.orga_id);

	const [viewedResult] = await pool.query<ResultSetHeader>(
		"UPDATE applications SET status = 'viewed' WHERE id = ? AND offer_id = ? AND status = 'submitted'",
		[applicationId, offerId]
	);

	if (viewedResult.affectedRows > 0) {
		await notifyApplicationUpdate(applicationId, offerId);
	}

	const [rows] = await pool.query<CompanyApplicationRow[]>(
		`
			${COMPANY_APPLICATION_SELECT}
			WHERE a.id = ? AND a.offer_id = ?
			LIMIT 1
		`,
		[applicationId, offerId]
	);
	const application = rows[0];

	if (!application) {
		throw createHttpError(404, "Application not found");
	}

	return { application: mapApplication(application) };
};

export const updateApplicationStatus = async (
	userId: number,
	offerId: number,
	applicationId: number,
	payload: CompanyApplicationStatusPayload
) => {
	const access = await requireCompanyMember(userId);
	await assertOfferBelongsToCompany(offerId, access.orga_id);
	const previousApplication = await getApplicationAcceptanceEmailData(applicationId, offerId, userId);

	const [result] = await pool.query<ResultSetHeader>(
		"UPDATE applications SET status = ? WHERE id = ? AND offer_id = ?",
		[payload.status, applicationId, offerId]
	);

	if (result.affectedRows === 0) {
		throw createHttpError(404, "Application not found");
	}

	await notifyApplicationUpdate(applicationId, offerId);

	if (payload.status === "accepted" && previousApplication?.status !== "accepted") {
		await sendApplicationAcceptedEmail(applicationId, offerId, userId);
	}

	return getOfferApplication(userId, offerId, applicationId);
};

const companyService = {
	getCompany,
	getCompanyData,
	createCompany,
	updateCompany,
	saveCompanyLogo,
	listMembers,
	listActivity,
	inviteMember,
	listInvitations,
	acceptInvitation,
	declineInvitation,
	kickMember,
	leaveCompany,
	listOffers,
	createOffer,
	updateOffer,
	closeOffer,
	listOfferApplications,
	getOfferApplication,
	updateApplicationStatus
};

export default companyService;
