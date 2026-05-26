import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { randomInt, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import pool from "../../config/database";
import { isExpired, toIsoDateOrNull, toIsoDateOrNow } from "../../helpers/date";
import { parsePositiveInteger } from "../../helpers/env";
import { hashToken } from "../../helpers/authTokens";
import createHttpError from "../../helpers/httpError";
import sendEmail from "../../helpers/mailer";
import { toPercent } from "../../helpers/number";
import { fetchOAuthProfile } from "../../helpers/oauth";
import { buildPagination } from "../../helpers/pagination";
import { normalizeEmail, sanitizeOptionalText } from "../../helpers/string";
import withTransaction from "../../helpers/transaction";
import { assertUploadSignature, sanitizeUploadFilename } from "../../helpers/upload";
import {
	buildPublicUser,
	getUserById,
	loadUserSkills,
	replaceUserSkills
} from "../users/users.repository";
import type {
	FavoritesQuery,
	OAuthCallbackPayload,
	OAuthProvider,
	UpdateMePayload,
	UpdatePasswordPayload
} from "./me.schemas";

const bcrypt = require("bcrypt");

interface FavoriteRow extends RowDataPacket {
	created_at: Date | string;
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

interface MeDataSummaryRow extends RowDataPacket {
	applications_count: number;
	submitted_count: number;
	viewed_count: number;
	accepted_count: number;
	rejected_count: number;
	withdrawn_count: number;
	favorites_count: number;
	stale_submitted_count: number;
}

interface MeTopSkillRow extends RowDataPacket {
	id: number;
	name: string;
	offers_count: number;
}

interface DeleteAccountCodeRow extends RowDataPacket {
	id: number;
	code_hash: string;
	expires_at: Date | string;
	used_at: Date | string | null;
}

interface SaveMeFilePayload {
	userId: string;
	buffer: Buffer;
	contentType?: string;
	originalName?: string;
	kind: "profile-photo" | "cv";
}

const parseUserId = (userId: string): number => {
	const numericUserId = Number(userId);

	if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
		throw createHttpError(401, "Unauthorized");
	}

	return numericUserId;
};

const generateDeleteCode = (): string => String(randomInt(0, 1000000)).padStart(6, "0");

const revokeAllUserSessions = async (
	connection: PoolConnection,
	userId: number
): Promise<void> => {
	await connection.query<ResultSetHeader>(
		"UPDATE refresh_tokens SET is_revoked = 1 WHERE user_id = ? AND is_revoked = 0",
		[userId]
	);

	await connection.query<ResultSetHeader>(
		"UPDATE sessions SET is_revoked = 1 WHERE user_id = ? AND is_revoked = 0",
		[userId]
	);
};

const getFileExtension = (contentType?: string, originalName?: string): string | null => {
	const byMime: Record<string, string> = {
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/webp": "webp",
		"application/pdf": "pdf",
		"application/msword": "doc",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx"
	};

	if (contentType && byMime[contentType]) {
		return byMime[contentType];
	}

	const ext = originalName ? path.extname(originalName).slice(1).toLowerCase() : "";
	return ext || null;
};

const assertAllowedFile = (
	kind: SaveMeFilePayload["kind"],
	buffer: Buffer,
	contentType?: string,
	originalName?: string
): string => {
	const extension = getFileExtension(contentType, originalName);
	const allowedExtensions =
		kind === "profile-photo" ? ["jpg", "jpeg", "png", "webp"] : ["pdf", "doc", "docx"];
	const maxSize =
		kind === "profile-photo"
			? parsePositiveInteger(process.env.PROFILE_PHOTO_MAX_BYTES, 5 * 1024 * 1024)
			: parsePositiveInteger(process.env.CV_MAX_BYTES, 10 * 1024 * 1024);

	if (buffer.length === 0) {
		throw createHttpError(400, "Uploaded file is empty");
	}

	if (buffer.length > maxSize) {
		throw createHttpError(413, "Uploaded file is too large");
	}

	if (!extension || !allowedExtensions.includes(extension)) {
		throw createHttpError(400, "Unsupported file type");
	}

	const normalizedExtension = extension === "jpeg" ? "jpg" : extension;
	assertUploadSignature(
		buffer,
		normalizedExtension,
		kind === "profile-photo" ? "image" : "document"
	);

	return normalizedExtension;
};

const mapFavoriteOffer = (row: FavoriteRow) => ({
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

export const getProfile = async (userId: string) => {
	const numericUserId = parseUserId(userId);
	const user = await getUserById(numericUserId);

	if (!user) {
		throw createHttpError(404, "User not found");
	}

	return { user: await buildPublicUser(user) };
};

export const getData = async (userId: string) => {
	const numericUserId = parseUserId(userId);
	const user = await getUserById(numericUserId);

	if (!user) {
		throw createHttpError(404, "User not found");
	}

	const [summaryResult, topSkillsResult, skills] = await Promise.all([
		pool.query<MeDataSummaryRow[]>(
			`
				SELECT
					(SELECT COUNT(*) FROM applications WHERE user_id = ?) AS applications_count,
					(SELECT COUNT(*) FROM applications WHERE user_id = ? AND status = 'submitted') AS submitted_count,
					(SELECT COUNT(*) FROM applications WHERE user_id = ? AND status = 'viewed') AS viewed_count,
					(SELECT COUNT(*) FROM applications WHERE user_id = ? AND status = 'accepted') AS accepted_count,
					(SELECT COUNT(*) FROM applications WHERE user_id = ? AND status = 'rejected') AS rejected_count,
					(SELECT COUNT(*) FROM applications WHERE user_id = ? AND status = 'withdrawn') AS withdrawn_count,
					(SELECT COUNT(*) FROM favorites WHERE user_id = ?) AS favorites_count,
					(
						SELECT COUNT(*)
						FROM applications
						WHERE user_id = ?
							AND status = 'submitted'
							AND applied_at < DATE_SUB(NOW(), INTERVAL 14 DAY)
					) AS stale_submitted_count
			`,
			[
				numericUserId,
				numericUserId,
				numericUserId,
				numericUserId,
				numericUserId,
				numericUserId,
				numericUserId,
				numericUserId
			]
		),
		pool.query<MeTopSkillRow[]>(
			`
				SELECT
					s.id,
					s.name,
					COUNT(DISTINCT source.offer_id) AS offers_count
				FROM (
					SELECT offer_id FROM applications WHERE user_id = ?
					UNION
					SELECT offer_id FROM favorites WHERE user_id = ?
				) source
				INNER JOIN offer_skills os ON os.offer_id = source.offer_id
				INNER JOIN skills s ON s.id = os.skill_id
				GROUP BY s.id
				ORDER BY offers_count DESC, s.name ASC
				LIMIT 10
			`,
			[numericUserId, numericUserId]
		),
		loadUserSkills(numericUserId)
	]);
	const summary = summaryResult[0][0];
	const applicationsCount = Number(summary?.applications_count ?? 0);
	const respondedApplicationsCount =
		Number(summary?.viewed_count ?? 0) +
		Number(summary?.accepted_count ?? 0) +
		Number(summary?.rejected_count ?? 0);
	const profileSuggestions: string[] = [];

	if (!user.cv_url) {
		profileSuggestions.push("upload_cv");
	}
	if (!user.short_bio) {
		profileSuggestions.push("add_short_bio");
	}
	if (!user.linkedin_url && !user.github_url && !user.portfolio_url) {
		profileSuggestions.push("add_profile_links");
	}
	if (skills.length === 0) {
		profileSuggestions.push("add_skills");
	}

	return {
		summary: {
			applicationsCount,
			submittedApplicationsCount: Number(summary?.submitted_count ?? 0),
			viewedApplicationsCount: Number(summary?.viewed_count ?? 0),
			acceptedApplicationsCount: Number(summary?.accepted_count ?? 0),
			rejectedApplicationsCount: Number(summary?.rejected_count ?? 0),
			withdrawnApplicationsCount: Number(summary?.withdrawn_count ?? 0),
			favoriteOffersCount: Number(summary?.favorites_count ?? 0),
			staleSubmittedApplicationsCount: Number(summary?.stale_submitted_count ?? 0),
			responseRate: toPercent(respondedApplicationsCount, applicationsCount)
		},
		topSkills: topSkillsResult[0].map((row) => ({
			id: row.id,
			name: row.name,
			offersCount: Number(row.offers_count ?? 0)
		})),
		profileSuggestions
	};
};

export const updateProfile = async (userId: string, payload: UpdateMePayload) => {
	const numericUserId = parseUserId(userId);
	const updateFields: string[] = [];
	const updateValues: unknown[] = [];

	if (payload.firstName !== undefined) {
		updateFields.push("firstname = ?");
		updateValues.push(payload.firstName.trim());
	}

	if (payload.lastName !== undefined) {
		updateFields.push("lastname = ?");
		updateValues.push(payload.lastName.trim());
	}

	if (payload.dateOfBirth !== undefined) {
		updateFields.push("date_of_birth = ?");
		updateValues.push(payload.dateOfBirth);
	}

	if (payload.status !== undefined) {
		updateFields.push("status = ?");
		updateValues.push(payload.status);
	}

	if (payload.shortBio !== undefined) {
		updateFields.push("short_bio = ?");
		updateValues.push(sanitizeOptionalText(payload.shortBio ?? undefined));
	}

	if (payload.linkedinUrl !== undefined) {
		updateFields.push("linkedin_url = ?");
		updateValues.push(sanitizeOptionalText(payload.linkedinUrl ?? undefined));
	}

	if (payload.githubUrl !== undefined) {
		updateFields.push("github_url = ?");
		updateValues.push(sanitizeOptionalText(payload.githubUrl ?? undefined));
	}

	if (payload.portfolioUrl !== undefined) {
		updateFields.push("portfolio_url = ?");
		updateValues.push(sanitizeOptionalText(payload.portfolioUrl ?? undefined));
	}

	if (payload.workLocation !== undefined) {
		updateFields.push("work_location = ?");
		updateValues.push(sanitizeOptionalText(payload.workLocation ?? undefined));
	}

	if (payload.darkMode !== undefined) {
		updateFields.push("dark_mode = ?");
		updateValues.push(payload.darkMode);
	}

	await withTransaction(async (connection) => {
		if (updateFields.length > 0) {
			await connection.query<ResultSetHeader>(
				`UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`,
				[...updateValues, numericUserId]
			);
		}

		if (payload.skills !== undefined) {
			await replaceUserSkills(connection, numericUserId, payload.skills);
		}
	});

	const updatedUser = await getUserById(numericUserId);

	if (!updatedUser) {
		throw createHttpError(404, "User not found");
	}

	return { user: await buildPublicUser(updatedUser) };
};

export const saveProfileFile = async ({
	userId,
	buffer,
	contentType,
	originalName,
	kind
}: SaveMeFilePayload) => {
	const numericUserId = parseUserId(userId);
	const user = await getUserById(numericUserId);

	if (!user) {
		throw createHttpError(404, "User not found");
	}

	const extension = assertAllowedFile(kind, buffer, contentType, originalName);
	const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads");
	const relativeDirectory = path.join("users", String(numericUserId));
	const targetDirectory = path.join(uploadRoot, relativeDirectory);
	const filename = `${kind}-${Date.now()}-${randomUUID()}.${extension}`;
	const relativePath = path.join(relativeDirectory, filename);
	const publicUrl = `/uploads/${relativePath.split(path.sep).join("/")}`;
	const safeOriginalName = sanitizeUploadFilename(originalName);

	await fs.mkdir(targetDirectory, { recursive: true });
	await fs.writeFile(path.join(uploadRoot, relativePath), buffer);

	const fieldSql =
		kind === "profile-photo"
			? "profile_photo_url = ?"
			: "cv_url = ?, cv_filename = ?";
	const values =
		kind === "profile-photo"
			? [publicUrl, numericUserId]
			: [publicUrl, safeOriginalName ?? filename, numericUserId];

	await pool.query<ResultSetHeader>(`UPDATE users SET ${fieldSql} WHERE id = ?`, values);

	const updatedUser = await getUserById(numericUserId);

	if (!updatedUser) {
		throw createHttpError(404, "User not found");
	}

	return { user: await buildPublicUser(updatedUser) };
};

export const linkOAuthProvider = async (
	userId: string,
	provider: OAuthProvider,
	payload: OAuthCallbackPayload
) => {
	const numericUserId = parseUserId(userId);
	const profile = await fetchOAuthProfile(provider, payload);

	const [existingProviderRows] = await pool.query<RowDataPacket[]>(
		"SELECT user_id FROM auth_providers WHERE provider_name = ? AND provider_id = ? LIMIT 1",
		[provider, profile.providerId]
	);
	const existingProvider = existingProviderRows[0];

	if (existingProvider && Number(existingProvider.user_id) !== numericUserId) {
		throw createHttpError(409, "OAuth account is already linked to another user");
	}

	const [currentProviderRows] = await pool.query<RowDataPacket[]>(
		"SELECT id FROM auth_providers WHERE user_id = ? AND provider_name = ? LIMIT 1",
		[numericUserId, provider]
	);

	if (currentProviderRows[0] && !existingProvider) {
		throw createHttpError(409, `${provider} is already linked to this account`);
	}

	await pool.query<ResultSetHeader>(
		`
			INSERT IGNORE INTO auth_providers (user_id, provider_name, provider_id, email)
			VALUES (?, ?, ?, ?)
		`,
		[numericUserId, provider, profile.providerId, normalizeEmail(profile.email)]
	);

	const updatedUser = await getUserById(numericUserId);

	if (!updatedUser) {
		throw createHttpError(404, "User not found");
	}

	return { user: await buildPublicUser(updatedUser) };
};

export const updatePassword = async (userId: string, payload: UpdatePasswordPayload) => {
	const numericUserId = parseUserId(userId);
	const user = await getUserById(numericUserId);

	if (!user) {
		throw createHttpError(404, "User not found");
	}

	if (!user.password_hash) {
		throw createHttpError(400, "Account does not use local password authentication");
	}

	const isCurrentPasswordValid = await bcrypt.compare(payload.currentPassword, user.password_hash);

	if (!isCurrentPasswordValid) {
		throw createHttpError(401, "Current password is invalid");
	}

	const [codeRows] = await pool.query<DeleteAccountCodeRow[]>(
		`
			SELECT id, code_hash, expires_at, used_at
			FROM email_verification_codes
			WHERE user_id = ?
			ORDER BY id DESC
			LIMIT 1
		`,
		[numericUserId]
	);
	const latestCode = codeRows[0];

	if (!latestCode || latestCode.used_at || isExpired(latestCode.expires_at)) {
		throw createHttpError(400, "Password confirmation code is invalid or expired");
	}

	if (latestCode.code_hash !== hashToken(payload.code)) {
		throw createHttpError(400, "Password confirmation code is invalid or expired");
	}

	const newPasswordHash = await bcrypt.hash(payload.newPassword, 12);

	await withTransaction(async (connection) => {
		await connection.query<ResultSetHeader>(
			"UPDATE email_verification_codes SET used_at = ? WHERE id = ?",
			[new Date(), latestCode.id]
		);

		await connection.query<ResultSetHeader>("UPDATE users SET password_hash = ? WHERE id = ?", [
			newPasswordHash,
			numericUserId
		]);

		await revokeAllUserSessions(connection, numericUserId);
	});
};

export const requestPasswordUpdateCode = async (userId: string): Promise<{ code?: string }> => {
	const numericUserId = parseUserId(userId);
	const user = await getUserById(numericUserId);

	if (!user || !user.email) {
		throw createHttpError(404, "User not found");
	}

	if (!user.password_hash) {
		throw createHttpError(400, "Account does not use local password authentication");
	}

	const code = generateDeleteCode();
	const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

	await withTransaction(async (connection) => {
		await connection.query<ResultSetHeader>(
			"UPDATE email_verification_codes SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
			[new Date(), numericUserId]
		);

		await connection.query<ResultSetHeader>(
			"INSERT INTO email_verification_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)",
			[numericUserId, hashToken(code), expiresAt]
		);
	});

	const sent = await sendEmail({
		to: user.email,
		subject: "Code de changement de mot de passe Starz",
		text: `Votre code de changement de mot de passe est ${code}. Il expire dans 10 minutes.`
	});

	if (!sent && process.env.NODE_ENV === "production") {
		throw createHttpError(500, "Email provider is not configured");
	}

	return process.env.NODE_ENV !== "production" && process.env.AUTH_DEBUG_TOKENS === "true"
		? { code }
		: {};
};

export const requestDeleteAccountCode = async (userId: string): Promise<{ code?: string }> => {
	const numericUserId = parseUserId(userId);
	const user = await getUserById(numericUserId);

	if (!user || !user.email) {
		throw createHttpError(404, "User not found");
	}

	const code = generateDeleteCode();
	const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

	await withTransaction(async (connection) => {
		await connection.query<ResultSetHeader>(
			"UPDATE email_verification_codes SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
			[new Date(), numericUserId]
		);

		await connection.query<ResultSetHeader>(
			"INSERT INTO email_verification_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)",
			[numericUserId, hashToken(code), expiresAt]
		);
	});

	const sent = await sendEmail({
		to: user.email,
		subject: "Code de suppression Starz",
		text: `Votre code de suppression de compte est ${code}. Il expire dans 10 minutes.`
	});

	if (!sent && process.env.NODE_ENV === "production") {
		throw createHttpError(500, "Email provider is not configured");
	}

	return process.env.NODE_ENV !== "production" && process.env.AUTH_DEBUG_TOKENS === "true"
		? { code }
		: {};
};

export const deleteAccount = async (userId: string, code: string): Promise<void> => {
	const numericUserId = parseUserId(userId);

	const [codeRows] = await pool.query<DeleteAccountCodeRow[]>(
		`
			SELECT id, code_hash, expires_at, used_at
			FROM email_verification_codes
			WHERE user_id = ?
			ORDER BY id DESC
			LIMIT 1
		`,
		[numericUserId]
	);
	const latestCode = codeRows[0];

	if (!latestCode || latestCode.used_at || isExpired(latestCode.expires_at)) {
		throw createHttpError(400, "Delete account code is invalid or expired");
	}

	if (latestCode.code_hash !== hashToken(code)) {
		throw createHttpError(400, "Delete account code is invalid or expired");
	}

	await withTransaction(async (connection) => {
		await connection.query<ResultSetHeader>(
			"UPDATE email_verification_codes SET used_at = ? WHERE id = ?",
			[new Date(), latestCode.id]
		);

		await connection.query<ResultSetHeader>("DELETE FROM moderation_logs WHERE admin_user_id = ?", [
			numericUserId
		]);

		const [result] = await connection.query<ResultSetHeader>("DELETE FROM users WHERE id = ?", [
			numericUserId
		]);

		if (result.affectedRows === 0) {
			throw createHttpError(404, "User not found");
		}
	});
};

export const listFavorites = async (userId: string, query: FavoritesQuery) => {
	const numericUserId = parseUserId(userId);
	const [countRows] = await pool.query<CountRow[]>(
		"SELECT COUNT(*) AS total FROM favorites WHERE user_id = ?",
		[numericUserId]
	);
	const total = Number(countRows[0]?.total ?? 0);

	const [rows] = await pool.query<FavoriteRow[]>(
		`
			SELECT
				f.created_at,
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
			FROM favorites f
			INNER JOIN offers o ON o.id = f.offer_id
			INNER JOIN companies c ON c.id = o.company_id
			WHERE f.user_id = ?
			ORDER BY f.created_at DESC
			LIMIT ? OFFSET ?
		`,
		[numericUserId, query.size, query.page * query.size]
	);

	return {
		items: rows.map((row) => ({
			createdAt: toIsoDateOrNow(row.created_at),
			offer: mapFavoriteOffer(row)
		})),
		pagination: buildPagination(query, total)
	};
};

const assertFavoriteOfferAvailable = async (offerId: number): Promise<void> => {
	const [rows] = await pool.query<RowDataPacket[]>(
		`
			SELECT o.id
			FROM offers o
			WHERE o.id = ?
				AND o.status = 'published'
				AND o.moderation_status = 'approved'
				AND (o.expires_at IS NULL OR o.expires_at >= NOW())
			LIMIT 1
		`,
		[offerId]
	);

	if (!rows[0]) {
		throw createHttpError(404, "Offer not found");
	}
};

export const addFavorite = async (userId: string, offerId: number) => {
	const numericUserId = parseUserId(userId);
	await assertFavoriteOfferAvailable(offerId);

	await pool.query<ResultSetHeader>(
		"INSERT IGNORE INTO favorites (user_id, offer_id) VALUES (?, ?)",
		[numericUserId, offerId]
	);

	return listFavorites(userId, { page: 0, size: 20 });
};

export const removeFavorite = async (userId: string, offerId: number): Promise<void> => {
	const numericUserId = parseUserId(userId);
	const [result] = await pool.query<ResultSetHeader>(
		"DELETE FROM favorites WHERE user_id = ? AND offer_id = ?",
		[numericUserId, offerId]
	);

	if (result.affectedRows === 0) {
		throw createHttpError(404, "Favorite not found");
	}
};

const meService = {
	getProfile,
	getData,
	updateProfile,
	saveProfileFile,
	linkOAuthProvider,
	updatePassword,
	requestPasswordUpdateCode,
	requestDeleteAccountCode,
	deleteAccount,
	listFavorites,
	addFavorite,
	removeFavorite
};

export default meService;
