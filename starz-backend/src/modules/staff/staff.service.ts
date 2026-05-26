import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import pool from "../../config/database";
import { toIsoDateOrNull, toIsoDateOrNow } from "../../helpers/date";
import createHttpError from "../../helpers/httpError";
import { roundTo, toPercent } from "../../helpers/number";
import { buildPagination } from "../../helpers/pagination";
import { sanitizeOptionalText } from "../../helpers/string";
import withTransaction from "../../helpers/transaction";
import offersService from "../offers/offers.service";
import { runWeLoveDevsSyncOnce } from "../../services/welovedevsSync";
import type {
	StaffBanUserPayload,
	StaffListCompaniesQuery,
	StaffListModerationLogsQuery,
	StaffListUsersQuery,
	StaffUpdateCompanyPayload,
	StaffUpdateOfferPayload,
	StaffModerationStatusPayload
} from "./staff.schemas";

interface StaffAccessRow extends RowDataPacket {
	role_name: string | null;
}

interface CountRow extends RowDataPacket {
	total: number;
}

interface StaffDataRow extends RowDataPacket {
	online_offers_count: number;
	all_time_offers_count: number;
	users_count: number;
	companies_count: number;
	expired_hired_offers_count: number;
	applications_count: number;
	accepted_applications_count: number;
	rejected_offers_count: number;
	banned_users_count: number;
	new_users_7d_count: number;
	new_users_30d_count: number;
	avg_processing_hours: number | null;
}

interface StaffTopCompanyRow extends RowDataPacket {
	id: number;
	name: string;
	offers_count: number;
	applications_count: number;
	accepted_count: number;
}

interface StaffTopSkillRow extends RowDataPacket {
	id: number;
	name: string;
	offers_count: number;
}

interface StaffUserRow extends RowDataPacket {
	id: number;
	firstname: string;
	lastname: string;
	email: string | null;
	status: "en_recherche" | "recruteur";
	role_name: string | null;
	orga_id: number | null;
	company_role: "owner" | "member" | null;
	company_name: string | null;
	banned_at: Date | string | null;
	ban_reason: string | null;
	created_at: Date | string;
	updated_at: Date | string;
}

interface StaffCompanyRow extends RowDataPacket {
	id: number;
	name: string;
	slug: string | null;
	website_url: string | null;
	description: string | null;
	logo_url: string | null;
	members_count: number;
	offers_count: number;
	created_at: Date | string;
	updated_at: Date | string;
}

interface StaffModerationLogRow extends RowDataPacket {
	id: number;
	admin_user_id: number;
	admin_firstname: string | null;
	admin_lastname: string | null;
	admin_email: string | null;
	target_user_id: number | null;
	target_firstname: string | null;
	target_lastname: string | null;
	target_email: string | null;
	offer_id: number | null;
	offer_title: string | null;
	action_type:
		| "offer_rejected"
		| "offer_archived"
		| "offer_restored"
		| "user_banned"
		| "user_unbanned"
		| "role_changed"
		| "other";
	reason: string | null;
	metadata: unknown;
	created_at: Date | string;
}

const mapUser = (row: StaffUserRow) => ({
	id: row.id,
	firstName: row.firstname,
	lastName: row.lastname,
	email: row.email,
	status: row.status,
	role: row.role_name ?? "user",
	orgaId: row.orga_id,
	companyRole: row.company_role,
	companyName: row.company_name,
	bannedAt: toIsoDateOrNull(row.banned_at),
	banReason: row.ban_reason,
	createdAt: toIsoDateOrNow(row.created_at),
	updatedAt: toIsoDateOrNow(row.updated_at)
});

const parseMetadata = (value: unknown): Record<string, unknown> | null => {
	if (value === null || value === undefined) {
		return null;
	}

	if (typeof value === "object") {
		return value as Record<string, unknown>;
	}

	if (typeof value === "string") {
		try {
			const parsed = JSON.parse(value) as unknown;
			return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : null;
		} catch {
			return null;
		}
	}

	return null;
};

const mapModerationLog = (row: StaffModerationLogRow) => ({
	id: row.id,
	adminUserId: row.admin_user_id,
	adminName: [row.admin_firstname, row.admin_lastname].filter(Boolean).join(" ") || row.admin_email || "Admin",
	adminEmail: row.admin_email,
	targetUserId: row.target_user_id,
	targetName: [row.target_firstname, row.target_lastname].filter(Boolean).join(" ") || row.target_email,
	targetEmail: row.target_email,
	offerId: row.offer_id,
	offerTitle: row.offer_title,
	actionType: row.action_type,
	reason: row.reason,
	metadata: parseMetadata(row.metadata),
	createdAt: toIsoDateOrNow(row.created_at)
});

const mapCompany = (row: StaffCompanyRow) => ({
	id: row.id,
	name: row.name,
	slug: row.slug,
	websiteUrl: row.website_url,
	description: row.description,
	logoUrl: row.logo_url,
	role: null,
	membersCount: Number(row.members_count ?? 0),
	offersCount: Number(row.offers_count ?? 0),
	createdAt: toIsoDateOrNow(row.created_at),
	updatedAt: toIsoDateOrNow(row.updated_at)
});

const getUserRole = async (userId: number): Promise<string | null | undefined> => {
	const [rows] = await pool.query<StaffAccessRow[]>(
		`
			SELECT r.name AS role_name
			FROM users u
			LEFT JOIN roles r ON r.id = u.role_id
			WHERE u.id = ?
			LIMIT 1
		`,
		[userId]
	);

	return rows[0]?.role_name;
};

const assertStaff = async (userId: number): Promise<void> => {
	const roleName = await getUserRole(userId);

	if (roleName !== "admin") {
		throw createHttpError(403, "Staff access is required");
	}
};

const assertTargetIsRegularUser = async (targetUserId: number, staffUserId: number): Promise<void> => {
	if (targetUserId === staffUserId) {
		throw createHttpError(403, "Cannot manage your own staff account");
	}

	const roleName = await getUserRole(targetUserId);

	if (roleName === undefined) {
		throw createHttpError(404, "User not found");
	}

	if (roleName === "admin") {
		throw createHttpError(403, "Cannot manage another staff account");
	}
};

const insertModerationLog = async ({
	adminUserId,
	targetUserId = null,
	offerId = null,
	actionType,
	reason = null,
	metadata = null
}: {
	adminUserId: number;
	targetUserId?: number | null;
	offerId?: number | null;
	actionType: StaffModerationLogRow["action_type"];
	reason?: string | null;
	metadata?: Record<string, unknown> | null;
}): Promise<void> => {
	await pool.query<ResultSetHeader>(
		`
			INSERT INTO moderation_logs
				(admin_user_id, target_user_id, offer_id, action_type, reason, metadata)
			VALUES (?, ?, ?, ?, ?, ?)
		`,
		[
			adminUserId,
			targetUserId,
			offerId,
			actionType,
			reason,
			metadata === null ? null : JSON.stringify(metadata)
		]
	);
};

export const getData = async (staffUserId: number) => {
	await assertStaff(staffUserId);

	const [rows, topCompanies, topSkills] = await Promise.all([
		pool.query<StaffDataRow[]>(
			`
			SELECT
				(
					SELECT COUNT(*)
					FROM offers
					WHERE status = 'published'
						AND moderation_status = 'approved'
						AND (expires_at IS NULL OR expires_at >= NOW())
				) AS online_offers_count,
				(SELECT COUNT(*) FROM offers) AS all_time_offers_count,
				(SELECT COUNT(*) FROM users) AS users_count,
				(SELECT COUNT(*) FROM companies) AS companies_count,
				(
					SELECT COUNT(DISTINCT o.id)
					FROM offers o
					INNER JOIN applications a ON a.offer_id = o.id
					WHERE o.expires_at IS NOT NULL
						AND o.expires_at < NOW()
						AND a.status = 'accepted'
				) AS expired_hired_offers_count,
				(SELECT COUNT(*) FROM applications) AS applications_count,
				(SELECT COUNT(*) FROM applications WHERE status = 'accepted') AS accepted_applications_count,
				(SELECT COUNT(*) FROM offers WHERE moderation_status = 'rejected') AS rejected_offers_count,
				(SELECT COUNT(*) FROM users WHERE banned_at IS NOT NULL) AS banned_users_count,
				(SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_users_7d_count,
				(SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS new_users_30d_count,
				(
					SELECT AVG(TIMESTAMPDIFF(HOUR, applied_at, updated_at))
					FROM applications
					WHERE status IN ('accepted', 'rejected')
				) AS avg_processing_hours
		`
		),
		pool.query<StaffTopCompanyRow[]>(
			`
				SELECT
					c.id,
					c.name,
					COUNT(DISTINCT o.id) AS offers_count,
					COUNT(a.id) AS applications_count,
					SUM(CASE WHEN a.status = 'accepted' THEN 1 ELSE 0 END) AS accepted_count
				FROM companies c
				LEFT JOIN offers o ON o.company_id = c.id
				LEFT JOIN applications a ON a.offer_id = o.id
				GROUP BY c.id
				ORDER BY applications_count DESC, offers_count DESC, c.id DESC
				LIMIT 5
			`
		),
		pool.query<StaffTopSkillRow[]>(
			`
				SELECT
					s.id,
					s.name,
					COUNT(os.offer_id) AS offers_count
				FROM skills s
				INNER JOIN offer_skills os ON os.skill_id = s.id
				GROUP BY s.id
				ORDER BY offers_count DESC, s.name ASC
				LIMIT 10
			`
		)
	]);
	const data = rows[0][0];
	const applicationsCount = Number(data?.applications_count ?? 0);
	const acceptedApplicationsCount = Number(data?.accepted_applications_count ?? 0);

	return {
		onlineOffersCount: Number(data?.online_offers_count ?? 0),
		allTimeOffersCount: Number(data?.all_time_offers_count ?? 0),
		usersCount: Number(data?.users_count ?? 0),
		companiesCount: Number(data?.companies_count ?? 0),
		expiredHiredOffersCount: Number(data?.expired_hired_offers_count ?? 0),
		applicationsCount,
		acceptedApplicationsCount,
		applicationConversionRate: toPercent(acceptedApplicationsCount, applicationsCount),
		rejectedOffersCount: Number(data?.rejected_offers_count ?? 0),
		bannedUsersCount: Number(data?.banned_users_count ?? 0),
		newUsersLast7DaysCount: Number(data?.new_users_7d_count ?? 0),
		newUsersLast30DaysCount: Number(data?.new_users_30d_count ?? 0),
		averageApplicationProcessingHours:
			data?.avg_processing_hours === null || data?.avg_processing_hours === undefined
				? null
				: roundTo(Number(data.avg_processing_hours)),
		topCompanies: topCompanies[0].map((row) => ({
			id: row.id,
			name: row.name,
			offersCount: Number(row.offers_count ?? 0),
			applicationsCount: Number(row.applications_count ?? 0),
			acceptedApplicationsCount: Number(row.accepted_count ?? 0)
		})),
		topSkills: topSkills[0].map((row) => ({
			id: row.id,
			name: row.name,
			offersCount: Number(row.offers_count ?? 0)
		}))
	};
};

export const listUsers = async (staffUserId: number, query: StaffListUsersQuery) => {
	await assertStaff(staffUserId);

	const whereClauses: string[] = [];
	const params: unknown[] = [];

	if (query.q) {
		whereClauses.push("(u.firstname LIKE ? OR u.lastname LIKE ? OR u.email LIKE ?)");
		params.push(`%${query.q}%`, `%${query.q}%`, `%${query.q}%`);
	}
	if (query.companyId) {
		whereClauses.push("u.orga_id = ?");
		params.push(query.companyId);
	}
	if (query.companyName) {
		whereClauses.push("c.name LIKE ?");
		params.push(`%${query.companyName}%`);
	}
	if (query.banned !== undefined) {
		whereClauses.push(query.banned ? "u.banned_at IS NOT NULL" : "u.banned_at IS NULL");
	}

	const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
	const [countRows] = await pool.query<CountRow[]>(
		`
			SELECT COUNT(*) AS total
			FROM users u
			LEFT JOIN companies c ON c.id = u.orga_id
			${whereSql}
		`,
		params
	);
	const total = Number(countRows[0]?.total ?? 0);

	const [rows] = await pool.query<StaffUserRow[]>(
		`
			SELECT
				u.id,
				u.firstname,
				u.lastname,
				u.email,
				u.status,
				r.name AS role_name,
				u.orga_id,
				u.company_role,
				c.name AS company_name,
				u.banned_at,
				u.ban_reason,
				u.created_at,
				u.updated_at
			FROM users u
			LEFT JOIN roles r ON r.id = u.role_id
			LEFT JOIN companies c ON c.id = u.orga_id
			${whereSql}
			ORDER BY u.created_at DESC, u.id DESC
			LIMIT ? OFFSET ?
		`,
		[...params, query.size, query.page * query.size]
	);

	return {
		items: rows.map(mapUser),
		pagination: buildPagination(query, total)
	};
};

export const listLogs = async (staffUserId: number, query: StaffListModerationLogsQuery) => {
	await assertStaff(staffUserId);

	const [countRows] = await pool.query<CountRow[]>("SELECT COUNT(*) AS total FROM moderation_logs");
	const total = Number(countRows[0]?.total ?? 0);

	const [rows] = await pool.query<StaffModerationLogRow[]>(
		`
			SELECT
				ml.id,
				ml.admin_user_id,
				admin.firstname AS admin_firstname,
				admin.lastname AS admin_lastname,
				admin.email AS admin_email,
				ml.target_user_id,
				target.firstname AS target_firstname,
				target.lastname AS target_lastname,
				target.email AS target_email,
				ml.offer_id,
				o.title AS offer_title,
				ml.action_type,
				ml.reason,
				ml.metadata,
				ml.created_at
			FROM moderation_logs ml
			INNER JOIN users admin ON admin.id = ml.admin_user_id
			LEFT JOIN users target ON target.id = ml.target_user_id
			LEFT JOIN offers o ON o.id = ml.offer_id
			ORDER BY ml.created_at DESC, ml.id DESC
			LIMIT ? OFFSET ?
		`,
		[query.size, query.page * query.size]
	);

	return {
		items: rows.map(mapModerationLog),
		pagination: buildPagination(query, total)
	};
};

export const banUser = async (
	staffUserId: number,
	targetUserId: number,
	payload: StaffBanUserPayload
) => {
	await assertStaff(staffUserId);
	await assertTargetIsRegularUser(targetUserId, staffUserId);

	const reason = sanitizeOptionalText(payload.reason ?? undefined);

	await withTransaction(async (connection) => {
		await connection.query<ResultSetHeader>(
			"UPDATE users SET banned_at = COALESCE(banned_at, NOW()), ban_reason = ? WHERE id = ?",
			[reason, targetUserId]
		);
		await connection.query<ResultSetHeader>(
			"UPDATE sessions SET is_revoked = 1 WHERE user_id = ? AND is_revoked = 0",
			[targetUserId]
		);
		await connection.query<ResultSetHeader>(
			"UPDATE refresh_tokens SET is_revoked = 1 WHERE user_id = ? AND is_revoked = 0",
			[targetUserId]
		);
		await connection.query<ResultSetHeader>(
			`
				INSERT INTO moderation_logs (admin_user_id, target_user_id, action_type, reason)
				VALUES (?, ?, 'user_banned', ?)
			`,
			[staffUserId, targetUserId, reason]
		);
	});

	return getUser(staffUserId, targetUserId);
};

export const unbanUser = async (staffUserId: number, targetUserId: number) => {
	await assertStaff(staffUserId);
	await assertTargetIsRegularUser(targetUserId, staffUserId);

	await withTransaction(async (connection) => {
		await connection.query<ResultSetHeader>(
			"UPDATE users SET banned_at = NULL, ban_reason = NULL WHERE id = ?",
			[targetUserId]
		);
		await connection.query<ResultSetHeader>(
			`
				INSERT INTO moderation_logs (admin_user_id, target_user_id, action_type)
				VALUES (?, ?, 'user_unbanned')
			`,
			[staffUserId, targetUserId]
		);
	});

	return getUser(staffUserId, targetUserId);
};

export const deleteUser = async (staffUserId: number, targetUserId: number): Promise<void> => {
	await assertStaff(staffUserId);
	await assertTargetIsRegularUser(targetUserId, staffUserId);

	await insertModerationLog({
		adminUserId: staffUserId,
		targetUserId,
		actionType: "other",
		reason: "user_deleted",
		metadata: { targetUserId }
	});

	const [result] = await pool.query<ResultSetHeader>("DELETE FROM users WHERE id = ?", [targetUserId]);

	if (result.affectedRows === 0) {
		throw createHttpError(404, "User not found");
	}
};

export const getUser = async (staffUserId: number, targetUserId: number) => {
	await assertStaff(staffUserId);

	const [rows] = await pool.query<StaffUserRow[]>(
		`
			SELECT
				u.id,
				u.firstname,
				u.lastname,
				u.email,
				u.status,
				r.name AS role_name,
				u.orga_id,
				u.company_role,
				c.name AS company_name,
				u.banned_at,
				u.ban_reason,
				u.created_at,
				u.updated_at
			FROM users u
			LEFT JOIN roles r ON r.id = u.role_id
			LEFT JOIN companies c ON c.id = u.orga_id
			WHERE u.id = ?
			LIMIT 1
		`,
		[targetUserId]
	);
	const user = rows[0];

	if (!user) {
		throw createHttpError(404, "User not found");
	}

	return { user: mapUser(user) };
};

export const listCompanies = async (staffUserId: number, query: StaffListCompaniesQuery) => {
	await assertStaff(staffUserId);

	const whereSql = query.q ? "WHERE c.name LIKE ? OR c.description LIKE ?" : "";
	const whereParams = query.q ? [`%${query.q}%`, `%${query.q}%`] : [];
	const orderSql = query.q
		? `
			ORDER BY
				CASE
					WHEN LOWER(c.name) = LOWER(?) THEN 0
					WHEN LOWER(c.name) LIKE CONCAT(LOWER(?), '%') THEN 1
					WHEN LOWER(c.name) LIKE CONCAT('%', LOWER(?), '%') THEN 2
					WHEN LOWER(c.description) LIKE CONCAT('%', LOWER(?), '%') THEN 3
					ELSE 4
				END ASC,
				c.created_at DESC,
				c.id DESC
		`
		: "ORDER BY c.created_at DESC, c.id DESC";
	const orderParams = query.q ? [query.q, query.q, query.q, query.q] : [];

	const [countRows] = await pool.query<CountRow[]>(
		`SELECT COUNT(*) AS total FROM companies c ${whereSql}`,
		whereParams
	);
	const total = Number(countRows[0]?.total ?? 0);

	const [rows] = await pool.query<StaffCompanyRow[]>(
		`
			SELECT
				c.id,
				c.name,
				c.slug,
				c.website_url,
				c.description,
				c.logo_url,
				c.created_at,
				c.updated_at,
				COUNT(DISTINCT u.id) AS members_count,
				COUNT(DISTINCT o.id) AS offers_count
			FROM companies c
			LEFT JOIN users u ON u.orga_id = c.id
			LEFT JOIN offers o ON o.company_id = c.id
			${whereSql}
			GROUP BY c.id
			${orderSql}
			LIMIT ? OFFSET ?
		`,
		[...whereParams, ...orderParams, query.size, query.page * query.size]
	);

	return {
		items: rows.map(mapCompany),
		pagination: buildPagination(query, total)
	};
};

export const updateCompany = async (
	staffUserId: number,
	companyId: number,
	payload: StaffUpdateCompanyPayload
) => {
	await assertStaff(staffUserId);

	const updateFields: string[] = [];
	const updateValues: unknown[] = [];

	if (payload.name !== undefined) {
		updateFields.push("name = ?");
		updateValues.push(payload.name);
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

	const [result] = await pool.query<ResultSetHeader>(
		`UPDATE companies SET ${updateFields.join(", ")} WHERE id = ?`,
		[...updateValues, companyId]
	);

	if (result.affectedRows === 0) {
		throw createHttpError(404, "Company not found");
	}

	await insertModerationLog({
		adminUserId: staffUserId,
		actionType: "other",
		reason: "company_updated",
		metadata: {
			companyId,
			updatedFields: Object.keys(payload)
		}
	});

	return getCompany(staffUserId, companyId);
};

export const deleteCompany = async (staffUserId: number, companyId: number): Promise<void> => {
	await assertStaff(staffUserId);

	const company = await getCompany(staffUserId, companyId);

	await insertModerationLog({
		adminUserId: staffUserId,
		actionType: "other",
		reason: "company_deleted",
		metadata: {
			companyId,
			companyName: company.company.name
		}
	});

	await withTransaction(async (connection) => {
		await connection.query<ResultSetHeader>(
			"UPDATE users SET orga_id = NULL, company_role = NULL WHERE orga_id = ?",
			[companyId]
		);
		await connection.query<ResultSetHeader>("DELETE FROM offers WHERE company_id = ?", [companyId]);
		const [result] = await connection.query<ResultSetHeader>("DELETE FROM companies WHERE id = ?", [
			companyId
		]);

		if (result.affectedRows === 0) {
			throw createHttpError(404, "Company not found");
		}
	});
};

export const getCompany = async (staffUserId: number, companyId: number) => {
	await assertStaff(staffUserId);

	const [rows] = await pool.query<StaffCompanyRow[]>(
		`
			SELECT
				c.id,
				c.name,
				c.slug,
				c.website_url,
				c.description,
				c.logo_url,
				c.created_at,
				c.updated_at,
				COUNT(DISTINCT u.id) AS members_count,
				COUNT(DISTINCT o.id) AS offers_count
			FROM companies c
			LEFT JOIN users u ON u.orga_id = c.id
			LEFT JOIN offers o ON o.company_id = c.id
			WHERE c.id = ?
			GROUP BY c.id
			LIMIT 1
		`,
		[companyId]
	);
	const company = rows[0];

	if (!company) {
		throw createHttpError(404, "Company not found");
	}

	return { company: mapCompany(company) };
};

export const listOffers = async (staffUserId: number, query: unknown) => {
	await assertStaff(staffUserId);
	return offersService.listAllOffers(query);
};

export const syncWeLoveDevs = async (staffUserId: number) => {
	await assertStaff(staffUserId);
	const result = await runWeLoveDevsSyncOnce({ force: true });

	await insertModerationLog({
		adminUserId: staffUserId,
		actionType: "other",
		reason: "welovedevs_sync",
		metadata: result as unknown as Record<string, unknown>
	});

	return result;
};

export const updateOffer = async (
	staffUserId: number,
	offerId: number,
	payload: StaffUpdateOfferPayload
) => {
	await assertStaff(staffUserId);
	const offer = await offersService.updateOffer(staffUserId, offerId, payload);

	await insertModerationLog({
		adminUserId: staffUserId,
		offerId,
		actionType: "other",
		reason: "offer_updated",
		metadata: {
			offerTitle: offer.title,
			updatedFields: Object.keys(payload)
		}
	});

	return { offer };
};

export const deleteOffer = async (staffUserId: number, offerId: number): Promise<void> => {
	await assertStaff(staffUserId);
	const offer = await offersService.getOfferById(offerId, { publicView: false });

	await insertModerationLog({
		adminUserId: staffUserId,
		offerId,
		actionType: "offer_archived",
		reason: "offer_deleted",
		metadata: {
			offerTitle: offer.title,
			companyName: offer.companyName
		}
	});

	await offersService.deleteOffer(staffUserId, offerId);
};

export const updateOfferModerationStatus = async (
	staffUserId: number,
	offerId: number,
	payload: StaffModerationStatusPayload
) => {
	await assertStaff(staffUserId);
	const offer = await offersService.updateOfferModerationStatus(
		staffUserId,
		offerId,
		payload.moderationStatus
	);

	await insertModerationLog({
		adminUserId: staffUserId,
		offerId,
		actionType: payload.moderationStatus === "rejected" ? "offer_rejected" : "offer_restored",
		reason: payload.moderationStatus,
		metadata: {
			offerTitle: offer.title,
			companyName: offer.companyName,
			moderationStatus: payload.moderationStatus
		}
	});

	return {
		offer
	};
};

const staffService = {
	getData,
	listLogs,
	listUsers,
	getUser,
	banUser,
	unbanUser,
	deleteUser,
	listCompanies,
	getCompany,
	updateCompany,
	deleteCompany,
	syncWeLoveDevs,
	listOffers,
	updateOffer,
	deleteOffer,
	updateOfferModerationStatus
};

export default staffService;
