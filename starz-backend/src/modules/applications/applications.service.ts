import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import pool from "../../config/database";
import { toIsoDateOrNull, toIsoDateOrNow } from "../../helpers/date";
import createHttpError from "../../helpers/httpError";
import { buildPagination } from "../../helpers/pagination";
import type {
	ApplicationsQuery,
	ApplicationStatus,
	CreateApplicationPayload
} from "./applications.schemas";

interface ApplicationRow extends RowDataPacket {
	id: number;
	status: ApplicationStatus;
	cover_letter: string | null;
	resume_url: string | null;
	applied_at: Date | string;
	created_at: Date | string;
	updated_at: Date | string;
	offer_id: number;
	title: string;
	description_preview: string | null;
	location: string | null;
	contract_type: string | null;
	remote_policy: string | null;
	offer_status: "draft" | "published" | "closed";
	moderation_status: "approved" | "rejected";
	expires_at: Date | string | null;
	company_id: number;
	company_name: string;
}

interface CountRow extends RowDataPacket {
	total: number;
}

interface UserApplicationAccessRow extends RowDataPacket {
	orga_id: number | null;
	cv_url: string | null;
}

interface OfferApplicationAccessRow extends RowDataPacket {
	id: number;
	company_id: number;
	status: "draft" | "published" | "closed";
	moderation_status: "approved" | "rejected";
	expires_at: Date | string | null;
}

interface ExistingApplicationRow extends RowDataPacket {
	id: number;
	status: ApplicationStatus;
}

const statusLabels: Record<ApplicationStatus, string> = {
	draft: "brouillon",
	submitted: "envoyé",
	viewed: "en cours d'examen",
	accepted: "accepté",
	rejected: "refusé",
	withdrawn: "retiré"
};

const isOfferUnavailableSql = `
	(o.status <> 'published' OR o.moderation_status <> 'approved' OR (o.expires_at IS NOT NULL AND o.expires_at < NOW()))
`;

const mapOffer = (row: ApplicationRow) => ({
	id: row.offer_id,
	companyId: row.company_id,
	companyName: row.company_name,
	title: row.title,
	descriptionPreview: row.description_preview,
	location: row.location,
	contractType: row.contract_type,
	remotePolicy: row.remote_policy,
	status: row.offer_status,
	moderationStatus: row.moderation_status,
	expiresAt: toIsoDateOrNull(row.expires_at)
});

const mapApplication = (row: ApplicationRow) => ({
	id: row.id,
	status: row.status,
	statusLabel: statusLabels[row.status],
	coverLetter: row.cover_letter,
	resumeUrl: row.resume_url,
	appliedAt: toIsoDateOrNow(row.applied_at),
	createdAt: toIsoDateOrNow(row.created_at),
	updatedAt: toIsoDateOrNow(row.updated_at),
	offer: mapOffer(row)
});

const isExpired = (value: Date | string | null): boolean => {
	if (!value) {
		return false;
	}

	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) || date.getTime() < Date.now();
};

const loadApplicationById = async (
	userId: number,
	applicationId: number
): Promise<ApplicationRow | null> => {
	const [rows] = await pool.query<ApplicationRow[]>(
		`
			SELECT
				a.id,
				a.status,
				a.cover_letter,
				a.resume_url,
				a.applied_at,
				a.created_at,
				a.updated_at,
				o.id AS offer_id,
				o.title,
				o.description_preview,
				o.location,
				o.contract_type,
				o.remote_policy,
				o.status AS offer_status,
				o.moderation_status,
				o.expires_at,
				c.id AS company_id,
				c.name AS company_name
			FROM applications a
			INNER JOIN offers o ON o.id = a.offer_id
			INNER JOIN companies c ON c.id = o.company_id
			WHERE a.id = ? AND a.user_id = ?
			LIMIT 1
		`,
		[applicationId, userId]
	);

	return rows[0] ?? null;
};

const listApplicationsByAvailability = async (
	userId: number,
	query: ApplicationsQuery,
	expired: boolean
) => {
	const whereClauses = ["a.user_id = ?", expired ? isOfferUnavailableSql : `NOT ${isOfferUnavailableSql}`];
	const params: unknown[] = [userId];

	if (query.status) {
		whereClauses.push("a.status = ?");
		params.push(query.status);
	}

	const whereSql = `WHERE ${whereClauses.join(" AND ")}`;
	const [countRows] = await pool.query<CountRow[]>(
		`
			SELECT COUNT(*) AS total
			FROM applications a
			INNER JOIN offers o ON o.id = a.offer_id
			${whereSql}
		`,
		params
	);
	const total = Number(countRows[0]?.total ?? 0);

	const [rows] = await pool.query<ApplicationRow[]>(
		`
			SELECT
				a.id,
				a.status,
				a.cover_letter,
				a.resume_url,
				a.applied_at,
				a.created_at,
				a.updated_at,
				o.id AS offer_id,
				o.title,
				o.description_preview,
				o.location,
				o.contract_type,
				o.remote_policy,
				o.status AS offer_status,
				o.moderation_status,
				o.expires_at,
				c.id AS company_id,
				c.name AS company_name
			FROM applications a
			INNER JOIN offers o ON o.id = a.offer_id
			INNER JOIN companies c ON c.id = o.company_id
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

export const listCurrentApplications = async (userId: number, query: ApplicationsQuery) =>
	listApplicationsByAvailability(userId, query, false);

export const listExpiredApplications = async (userId: number, query: ApplicationsQuery) =>
	listApplicationsByAvailability(userId, query, true);

export const getApplication = async (userId: number, applicationId: number) => {
	const application = await loadApplicationById(userId, applicationId);

	if (!application) {
		throw createHttpError(404, "Application not found");
	}

	return { application: mapApplication(application) };
};

export const createApplication = async (userId: number, payload: CreateApplicationPayload) => {
	const [userResult, offerResult, existingResult] = await Promise.all([
		pool.query<UserApplicationAccessRow[]>(
			"SELECT orga_id, cv_url FROM users WHERE id = ? LIMIT 1",
			[userId]
		),
		pool.query<OfferApplicationAccessRow[]>(
			`
				SELECT id, company_id, status, moderation_status, expires_at
				FROM offers
				WHERE id = ?
				LIMIT 1
			`,
			[payload.offerId]
		),
		pool.query<ExistingApplicationRow[]>(
			"SELECT id, status FROM applications WHERE user_id = ? AND offer_id = ? LIMIT 1",
			[userId, payload.offerId]
		)
	]);
	const currentUser = userResult[0][0];
	const offerRows = offerResult[0];
	const existingRows = existingResult[0];
	const offer = offerRows[0];
	const existingApplication = existingRows[0];

	if (!currentUser) {
		throw createHttpError(401, "Unauthorized");
	}

	if (
		!offer ||
		offer.status !== "published" ||
		offer.moderation_status !== "approved" ||
		isExpired(offer.expires_at)
	) {
		throw createHttpError(404, "Offer not found");
	}

	if (currentUser.orga_id === offer.company_id) {
		throw createHttpError(403, "Cannot apply to an offer from your own company");
	}

	if (payload.resumeUrl && !payload.resumeUrl.startsWith(`/uploads/users/${userId}/`)) {
		throw createHttpError(400, "resumeUrl must reference one of your uploaded CV files");
	}

	const resumeUrl = payload.resumeUrl ?? currentUser.cv_url;
	let applicationId = existingApplication?.id;

	if (existingApplication && existingApplication.status !== "withdrawn") {
		throw createHttpError(409, "Application already exists for this offer");
	}

	if (existingApplication) {
		await pool.query<ResultSetHeader>(
			`
				UPDATE applications
				SET status = 'submitted', cover_letter = ?, resume_url = ?, applied_at = ?
				WHERE id = ? AND user_id = ?
			`,
			[payload.coverLetter ?? null, resumeUrl ?? null, new Date(), applicationId, userId]
		);
	} else {
		const [result] = await pool.query<ResultSetHeader>(
			`
				INSERT INTO applications (user_id, offer_id, status, cover_letter, resume_url)
				VALUES (?, ?, 'submitted', ?, ?)
			`,
			[userId, payload.offerId, payload.coverLetter ?? null, resumeUrl ?? null]
		);
		applicationId = Number(result.insertId);
	}

	if (!applicationId) {
		throw createHttpError(500, "Failed to create application");
	}

	return getApplication(userId, applicationId);
};

export const withdrawApplication = async (userId: number, applicationId: number) => {
	const [result] = await pool.query<ResultSetHeader>(
		`
			UPDATE applications
			SET status = 'withdrawn'
			WHERE id = ?
				AND user_id = ?
				AND status IN ('draft', 'submitted', 'viewed')
		`,
		[applicationId, userId]
	);

	if (result.affectedRows === 0) {
		const application = await loadApplicationById(userId, applicationId);

		if (!application) {
			throw createHttpError(404, "Application not found");
		}

		throw createHttpError(409, "Application cannot be withdrawn");
	}

	return getApplication(userId, applicationId);
};

const applicationsService = {
	listCurrentApplications,
	listExpiredApplications,
	getApplication,
	createApplication,
	withdrawApplication
};

export default applicationsService;
