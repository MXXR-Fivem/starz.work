import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import pool from "../../config/database";
import { toIsoDate, toIsoDateOrNull, toIsoDateOrNow } from "../../helpers/date";
import { normalizeSkill } from "../../helpers/string";
import type { OAuthProvider } from "../auth/auth.schemas";

export interface UserRow extends RowDataPacket {
	id: number;
	firstname: string;
	lastname: string;
	email: string | null;
	orga_id: number | null;
	company_role: "owner" | "member" | null;
	date_of_birth: Date | string | null;
	status: "en_recherche" | "recruteur";
	banned_at: Date | string | null;
	ban_reason: string | null;
	profile_photo_url: string | null;
	short_bio: string | null;
	linkedin_url: string | null;
	github_url: string | null;
	portfolio_url: string | null;
	work_location: string | null;
	cv_url: string | null;
	cv_filename: string | null;
	dark_mode: 0 | 1 | boolean;
	last_login_at: Date | string | null;
	email_verified_at: Date | string | null;
	created_at: Date | string;
	updated_at: Date | string;
	role_id: number;
	role_name: string | null;
	password_hash: string | null;
}

export interface PublicUser {
	id: number;
	email: string | null;
	orgaId: number | null;
	companyRole: "owner" | "member" | null;
	firstName: string;
	lastName: string;
	dateOfBirth: string | null;
	status: "en_recherche" | "recruteur";
	bannedAt: string | null;
	banReason: string | null;
	profilePhotoUrl: string | null;
	shortBio: string | null;
	linkedinUrl: string | null;
	githubUrl: string | null;
	portfolioUrl: string | null;
	workLocation: string | null;
	cvUrl: string | null;
	cvFilename: string | null;
	darkMode: boolean;
	skills: { id: number; name: string }[];
	linkedProviders: OAuthProvider[];
	hasPassword: boolean;
	role: string;
	emailVerifiedAt: string | null;
	lastLoginAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export const USER_SELECT = `
	SELECT
		u.id,
		u.firstname,
		u.lastname,
		u.email,
		u.orga_id,
		u.company_role,
		u.password_hash,
		u.date_of_birth,
		u.status,
		u.banned_at,
		u.ban_reason,
		u.profile_photo_url,
		u.short_bio,
		u.linkedin_url,
		u.github_url,
		u.portfolio_url,
		u.work_location,
		u.cv_url,
		u.cv_filename,
		u.dark_mode,
		u.last_login_at,
		u.email_verified_at,
		u.created_at,
		u.updated_at,
		u.role_id,
		r.name AS role_name
	FROM users u
	LEFT JOIN roles r ON r.id = u.role_id
`;

export const getUserById = async (userId: number): Promise<UserRow | null> => {
	const [rows] = await pool.query<UserRow[]>(`${USER_SELECT} WHERE u.id = ? LIMIT 1`, [userId]);
	return rows[0] ?? null;
};

export const getUserByEmail = async (email: string): Promise<UserRow | null> => {
	const [rows] = await pool.query<UserRow[]>(`${USER_SELECT} WHERE u.email = ? LIMIT 1`, [email]);
	return rows[0] ?? null;
};

export const getUserByProvider = async (
	provider: OAuthProvider,
	providerId: string
): Promise<UserRow | null> => {
	const [rows] = await pool.query<UserRow[]>(
		`
			${USER_SELECT}
			INNER JOIN auth_providers ap ON ap.user_id = u.id
			WHERE ap.provider_name = ? AND ap.provider_id = ?
			LIMIT 1
		`,
		[provider, providerId]
	);

	return rows[0] ?? null;
};

export const loadUserSkills = async (userId: number): Promise<{ id: number; name: string }[]> => {
	const [rows] = await pool.query<(RowDataPacket & { id: number; name: string })[]>(
		`
			SELECT s.id, s.name
			FROM user_skills us
			INNER JOIN skills s ON s.id = us.skill_id
			WHERE us.user_id = ?
			ORDER BY s.name ASC
		`,
		[userId]
	);

	return rows.map((row) => ({ id: row.id, name: row.name }));
};

export const loadLinkedProviders = async (userId: number): Promise<OAuthProvider[]> => {
	const [rows] = await pool.query<(RowDataPacket & { provider_name: OAuthProvider })[]>(
		"SELECT provider_name FROM auth_providers WHERE user_id = ? AND provider_name <> 'local' ORDER BY provider_name ASC",
		[userId]
	);

	return rows.map((row) => row.provider_name);
};

export const buildPublicUser = async (
	user: UserRow,
	options?: { strictDates?: boolean }
): Promise<PublicUser> => {
	const formatDate = options?.strictDates ? toIsoDate : toIsoDateOrNow;

	return {
		id: user.id,
		email: user.email,
		orgaId: user.orga_id,
		companyRole: user.company_role,
		firstName: user.firstname,
		lastName: user.lastname,
		dateOfBirth: toIsoDateOrNull(user.date_of_birth),
		status: user.status,
		bannedAt: toIsoDateOrNull(user.banned_at),
		banReason: user.ban_reason,
		profilePhotoUrl: user.profile_photo_url,
		shortBio: user.short_bio,
		linkedinUrl: user.linkedin_url,
		githubUrl: user.github_url,
		portfolioUrl: user.portfolio_url,
		workLocation: user.work_location,
		cvUrl: user.cv_url,
		cvFilename: user.cv_filename,
		darkMode: Boolean(user.dark_mode),
		skills: await loadUserSkills(user.id),
		linkedProviders: await loadLinkedProviders(user.id),
		hasPassword: Boolean(user.password_hash),
		role: user.role_name ?? "user",
		emailVerifiedAt: toIsoDateOrNull(user.email_verified_at),
		lastLoginAt: toIsoDateOrNull(user.last_login_at),
		createdAt: formatDate(user.created_at),
		updatedAt: formatDate(user.updated_at)
	};
};

export const replaceUserSkills = async (
	connection: PoolConnection,
	userId: number,
	skills: string[]
): Promise<void> => {
	const uniqueSkills = Array.from(new Set(skills.map((skill) => skill.trim()).filter(Boolean)));

	await connection.query<ResultSetHeader>("DELETE FROM user_skills WHERE user_id = ?", [userId]);

	for (const skill of uniqueSkills) {
		const { name, normalizedName } = normalizeSkill(skill);
		const [insertSkillResult] = await connection.query<ResultSetHeader>(
			`
				INSERT INTO skills (name, normalized_name)
				VALUES (?, ?)
				ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), name = VALUES(name)
			`,
			[name.slice(0, 100), normalizedName.slice(0, 100)]
		);

		await connection.query<ResultSetHeader>(
			"INSERT IGNORE INTO user_skills (user_id, skill_id) VALUES (?, ?)",
			[userId, Number(insertSkillResult.insertId)]
		);
	}
};
