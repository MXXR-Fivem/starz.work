import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { randomInt } from "node:crypto";

import pool from "../../config/database";
import {
	createAccessToken,
	createPasswordResetToken,
	createRefreshTokenBundle,
	generateSecureToken,
	hashToken,
	verifyPasswordResetToken
} from "../../helpers/authTokens";
import { isExpired, toIsoDate, toIsoDateOrNull } from "../../helpers/date";
import { parsePositiveInteger } from "../../helpers/env";
import createHttpError from "../../helpers/httpError";
import sendEmail from "../../helpers/mailer";
import {
	fetchOAuthProfile,
	getOAuthAuthorizationUrl as buildOAuthAuthorizationUrl
} from "../../helpers/oauth";
import { normalizeEmail, sanitizeOptionalText } from "../../helpers/string";
import withTransaction from "../../helpers/transaction";
import type {
	LoginPayload,
	OAuthAuthorizeQuery,
	OAuthCallbackPayload,
	OAuthProvider,
	RegisterPayload
} from "./auth.schemas";
import {
	buildPublicUser,
	getUserByEmail,
	getUserById,
	getUserByProvider,
	type PublicUser,
	type UserRow
} from "../users/users.repository";

const bcrypt = require("bcrypt");

interface LoginContext {
	ipAddress?: string;
	userAgent?: string;
}

interface LogoutPayload {
	userId: string;
	refreshToken?: string;
	sessionId?: number;
}

interface RefreshTokenRow extends UserRow {
	refresh_id: number;
	refresh_is_revoked: number;
	refresh_expires_at: Date | string;
	session_id: number | null;
	session_is_revoked: number | null;
	session_expires_at: Date | string | null;
}

interface AuthTokensPayload {
	accessToken: string;
	refreshToken: string;
	tokenType: "Bearer";
	expiresIn: string;
}

interface RegisterResult {
	user: PublicUser;
	emailVerificationCode?: string;
}

interface LoginResult {
	user: PublicUser;
	tokens: AuthTokensPayload;
}

interface LogoutResult {
	message: string;
}

interface SessionListRow extends RowDataPacket {
	id: number;
	ip_address: string | null;
	user_agent: string | null;
	expires_at: Date | string;
	last_seen_at: Date | string | null;
	created_at: Date | string;
}

interface AuthSession {
	id: number;
	ipAddress: string | null;
	userAgent: string | null;
	expiresAt: string;
	lastSeenAt: string | null;
	createdAt: string;
	isCurrentSession: boolean;
}

interface SessionsResult {
	sessions: AuthSession[];
}

interface VerifyEmailResult {
	alreadyVerified: boolean;
	user?: PublicUser;
	tokens?: AuthTokensPayload;
}

interface ResendVerificationResult {
	code?: string;
}

interface ForgotPasswordResult {
	token?: string;
}

interface OAuthAuthorizationUrlResult {
	url: string;
}

interface EmailVerificationCodeRow extends RowDataPacket {
	id: number;
	user_id: number;
	code_hash: string;
	expires_at: Date | string;
	used_at: Date | string | null;
	created_at: Date | string;
}

const shouldExposeDebugAuthTokens = (): boolean =>
	process.env.NODE_ENV !== "production" && process.env.AUTH_DEBUG_TOKENS === "true";

const getDebugToken = (token: string): string | undefined => {
	return shouldExposeDebugAuthTokens() ? token : undefined;
};

const getDebugCode = (code: string): string | undefined => {
	return shouldExposeDebugAuthTokens() ? code : undefined;
};

const buildPasswordResetUrl = (token: string): string | null => {
	const rawUrl = process.env.FRONTEND_RESET_PASSWORD_URL?.trim();

	if (!rawUrl) {
		if (process.env.NODE_ENV === "production") {
			throw createHttpError(500, "FRONTEND_RESET_PASSWORD_URL is not configured");
		}

		return null;
	}

	try {
		const resetUrl = new URL(rawUrl);
		resetUrl.searchParams.set("token", token);
		return resetUrl.toString();
	} catch (_error) {
		throw createHttpError(500, "FRONTEND_RESET_PASSWORD_URL is invalid");
	}
};

const addMinutes = (date: Date, minutes: number): Date => {
	const next = new Date(date);
	next.setMinutes(next.getMinutes() + minutes);
	return next;
};

const diffInSeconds = (from: Date, to: Date): number => {
	return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
};

const resolveDefaultRoleId = async (): Promise<number> => {
	const [existingRoleRows] = await pool.query<RowDataPacket[]>(
		"SELECT id FROM roles ORDER BY id ASC LIMIT 1"
	);

	if (existingRoleRows.length > 0) {
		return Number(existingRoleRows[0].id);
	}

	const [insertResult] = await pool.query<ResultSetHeader>(
		"INSERT INTO roles (name) VALUES (?)",
		["user"]
	);

	return Number(insertResult.insertId);
};

const generateVerificationCode = (): string => {
	return String(randomInt(0, 1000000)).padStart(6, "0");
};

const createAndSendEmailVerificationCode = async (user: UserRow): Promise<string | undefined> => {
	if (!user.email) {
		return undefined;
	}

	const resendCooldownSeconds = parsePositiveInteger(
		process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
		120
	);
	const [latestRows] = await pool.query<EmailVerificationCodeRow[]>(
		`
			SELECT id, user_id, code_hash, expires_at, used_at, created_at
			FROM email_verification_codes
			WHERE user_id = ?
			ORDER BY id DESC
			LIMIT 1
		`,
		[user.id]
	);
	const latestRow = latestRows[0];

	if (latestRow) {
		const createdAt = latestRow.created_at instanceof Date
			? latestRow.created_at
			: new Date(latestRow.created_at);
		const elapsedSeconds = diffInSeconds(createdAt, new Date());

		if (elapsedSeconds < resendCooldownSeconds) {
			return undefined;
		}
	}

	const code = generateVerificationCode();
	const codeHash = hashToken(code);
	const ttlMinutes = parsePositiveInteger(process.env.EMAIL_VERIFICATION_CODE_TTL_MINUTES, 10);
	const expiresAt = addMinutes(new Date(), ttlMinutes);

	await withTransaction(async (connection) => {
		await connection.query<ResultSetHeader>(
			"UPDATE email_verification_codes SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
			[new Date(), user.id]
		);

		await connection.query<ResultSetHeader>(
			`
				INSERT INTO email_verification_codes (user_id, code_hash, expires_at)
				VALUES (?, ?, ?)
			`,
			[user.id, codeHash, expiresAt]
		);
	});

	const sent = await sendEmail({
		to: user.email,
		subject: "Code de verification Starz",
		text: `Votre code de verification est ${code}. Il expire dans ${ttlMinutes} minutes.`
	});

	if (!sent && process.env.NODE_ENV === "production") {
		throw createHttpError(500, "Email provider is not configured");
	}

	return getDebugCode(code);
};

const hasLocalAuthProvider = async (userId: number): Promise<boolean> => {
	const [rows] = await pool.query<RowDataPacket[]>(
		"SELECT id FROM auth_providers WHERE user_id = ? AND provider_name = 'local' LIMIT 1",
		[userId]
	);

	return rows.length > 0;
};

const assertUserNotBanned = (user: UserRow): void => {
	if (user.banned_at !== null) {
		throw createHttpError(403, "User account is banned");
	}
};

const parseUserIdOrThrow = (userId: string): number => {
	const numericUserId = Number(userId);

	if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
		throw createHttpError(401, "Unauthorized");
	}

	return numericUserId;
};

const createSessionToken = (): string => hashToken(generateSecureToken(48));

const createSessionAndTokens = async (
	user: UserRow,
	context: LoginContext
): Promise<AuthTokensPayload> => {
	return withTransaction(async (connection) => {
		const refreshTokenBundle = createRefreshTokenBundle();
		const sessionToken = createSessionToken();

		const [sessionInsertResult] = await connection.query<ResultSetHeader>(
			`
				INSERT INTO sessions (
					user_id,
					session_token,
					ip_address,
					user_agent,
					expires_at,
					last_seen_at
				) VALUES (?, ?, ?, ?, ?, ?)
			`,
			[
				user.id,
				sessionToken,
				sanitizeOptionalText(context.ipAddress),
				sanitizeOptionalText(context.userAgent),
				refreshTokenBundle.expiresAt,
				new Date()
			]
		);

		const sessionId = Number(sessionInsertResult.insertId);

		await connection.query<ResultSetHeader>(
			`
				INSERT INTO refresh_tokens (
					user_id,
					session_id,
					token_hash,
					expires_at
				) VALUES (?, ?, ?, ?)
			`,
			[user.id, sessionId, refreshTokenBundle.tokenHash, refreshTokenBundle.expiresAt]
		);

		return {
			accessToken: createAccessToken({
				userId: user.id,
				email: user.email,
				role: user.role_name ?? "user",
				sessionId
			}),
			refreshToken: refreshTokenBundle.token,
			tokenType: "Bearer",
			expiresIn: process.env.JWT_EXPIRES_IN ?? "15m"
		};
	});
};

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

export const register = async (payload: RegisterPayload): Promise<RegisterResult> => {
	const normalizedEmail = normalizeEmail(payload.email);
	const existingUser = await getUserByEmail(normalizedEmail);

	if (existingUser) {
		throw createHttpError(409, "An account already exists with this email");
	}

	const roleId = await resolveDefaultRoleId();
	const passwordHash = await bcrypt.hash(payload.password, 12);

	const [insertUserResult] = await pool.query<ResultSetHeader>(
		`
			INSERT INTO users (
				role_id,
				firstname,
				lastname,
				email,
				password_hash,
				date_of_birth,
				status
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`,
		[
			roleId,
			payload.firstName.trim(),
			payload.lastName.trim(),
			normalizedEmail,
			passwordHash,
			payload.dateOfBirth ?? null,
			payload.status ?? "en_recherche"
		]
	);

	const userId = Number(insertUserResult.insertId);

	await pool.query<ResultSetHeader>(
		`
			INSERT INTO auth_providers (user_id, provider_name, provider_id, email)
			VALUES (?, 'local', ?, ?)
		`,
		[userId, String(userId), normalizedEmail]
	);

	const createdUser = await getUserById(userId);

	if (!createdUser) {
		throw createHttpError(500, "Failed to load created user");
	}

	const emailVerificationCode = await createAndSendEmailVerificationCode(createdUser);

	return {
		user: await buildPublicUser(createdUser, { strictDates: true }),
		emailVerificationCode
	};
};

export const login = async (
	payload: LoginPayload,
	context: LoginContext
): Promise<LoginResult> => {
	const normalizedEmail = normalizeEmail(payload.email);
	const user = await getUserByEmail(normalizedEmail);

	if (!user) {
		throw createHttpError(401, "Invalid email or password");
	}

	assertUserNotBanned(user);

	if (!user.password_hash || !(await hasLocalAuthProvider(user.id))) {
		throw createHttpError(401, "Invalid email or password");
	}

	const isPasswordValid = await bcrypt.compare(payload.password, user.password_hash);

	if (!isPasswordValid) {
		throw createHttpError(401, "Invalid email or password");
	}

	await pool.query<ResultSetHeader>("UPDATE users SET last_login_at = ? WHERE id = ?", [
		new Date(),
		user.id
	]);

	const refreshedUser = await getUserById(user.id);

	if (!refreshedUser) {
		throw createHttpError(500, "Failed to load user");
	}

	return {
		user: await buildPublicUser(refreshedUser, { strictDates: true }),
		tokens: await createSessionAndTokens(refreshedUser, context)
	};
};

export const getOAuthAuthorizationUrl = async (
	provider: OAuthProvider,
	query: OAuthAuthorizeQuery
): Promise<OAuthAuthorizationUrlResult> => {
	return {
		url: buildOAuthAuthorizationUrl(provider, query)
	};
};

export const oauthCallback = async (
	provider: OAuthProvider,
	payload: OAuthCallbackPayload,
	context: LoginContext
): Promise<LoginResult> => {
	const profile = await fetchOAuthProfile(provider, payload);
	const normalizedEmail = normalizeEmail(profile.email);

	let user = await getUserByProvider(provider, profile.providerId);

	if (!user) {
		const existingUser = await getUserByEmail(normalizedEmail);

		if (existingUser) {
			await pool.query<ResultSetHeader>(
				`
					INSERT INTO auth_providers (user_id, provider_name, provider_id, email)
					VALUES (?, ?, ?, ?)
				`,
				[existingUser.id, provider, profile.providerId, normalizedEmail]
			);

			user = existingUser;
		} else {
			const roleId = await resolveDefaultRoleId();

			const [insertUserResult] = await pool.query<ResultSetHeader>(
				`
					INSERT INTO users (
						role_id,
						firstname,
						lastname,
						email,
						status,
						email_verified_at
					) VALUES (?, ?, ?, ?, ?, ?)
				`,
				[
					roleId,
					profile.firstName.trim(),
					profile.lastName.trim(),
					normalizedEmail,
					"en_recherche",
					new Date()
				]
			);

			const userId = Number(insertUserResult.insertId);

			await pool.query<ResultSetHeader>(
				`
					INSERT INTO auth_providers (user_id, provider_name, provider_id, email)
					VALUES (?, ?, ?, ?)
				`,
				[userId, provider, profile.providerId, normalizedEmail]
			);

			user = await getUserById(userId);
		}
	}

	if (!user) {
		throw createHttpError(500, "Failed to load user");
	}

	assertUserNotBanned(user);

	await pool.query<ResultSetHeader>("UPDATE users SET last_login_at = ? WHERE id = ?", [
		new Date(),
		user.id
	]);

	const refreshedUser = await getUserById(user.id);

	if (!refreshedUser) {
		throw createHttpError(500, "Failed to load user");
	}

	return {
		user: await buildPublicUser(refreshedUser, { strictDates: true }),
		tokens: await createSessionAndTokens(refreshedUser, context)
	};
};

export const logout = async ({
	userId,
	refreshToken,
	sessionId
}: LogoutPayload): Promise<LogoutResult> => {
	const numericUserId = parseUserIdOrThrow(userId);

	if (!refreshToken) {
		if (sessionId) {
			return revokeSession(userId, sessionId);
		}

		return revokeAllSessions(userId);
	}

	const tokenHash = hashToken(refreshToken);
	const [refreshRows] = await pool.query<RowDataPacket[]>(
		"SELECT id, session_id FROM refresh_tokens WHERE user_id = ? AND token_hash = ? LIMIT 1",
		[numericUserId, tokenHash]
	);

	const refreshRow = refreshRows[0];

	if (!refreshRow) {
		return {
			message: "Session already logged out"
		};
	}

	await withTransaction(async (connection) => {
		await connection.query<ResultSetHeader>(
			"UPDATE refresh_tokens SET is_revoked = 1 WHERE id = ?",
			[Number(refreshRow.id)]
		);

		if (refreshRow.session_id) {
			await connection.query<ResultSetHeader>("UPDATE sessions SET is_revoked = 1 WHERE id = ?", [
				Number(refreshRow.session_id)
			]);
		}
	});

	return {
		message: "Logged out successfully"
	};
};

export const listSessions = async (
	userId: string,
	currentSessionId: number
): Promise<SessionsResult> => {
	const numericUserId = parseUserIdOrThrow(userId);

	const [rows] = await pool.query<SessionListRow[]>(
		`
			SELECT id, ip_address, user_agent, expires_at, last_seen_at, created_at
			FROM sessions
			WHERE user_id = ? AND is_revoked = 0 AND expires_at > NOW()
			ORDER BY
				CASE WHEN id = ? THEN 0 ELSE 1 END ASC,
				last_seen_at DESC,
				created_at DESC
		`,
		[numericUserId, currentSessionId]
	);

	return {
		sessions: rows.map((row) => ({
			id: row.id,
			ipAddress: row.ip_address,
			userAgent: row.user_agent,
			expiresAt: toIsoDate(row.expires_at),
			lastSeenAt: toIsoDateOrNull(row.last_seen_at),
			createdAt: toIsoDate(row.created_at),
			isCurrentSession: row.id === currentSessionId
		}))
	};
};

export const revokeSession = async (
	userId: string,
	sessionId: number
): Promise<LogoutResult> => {
	const numericUserId = parseUserIdOrThrow(userId);

	const [rows] = await pool.query<RowDataPacket[]>(
		"SELECT id, is_revoked FROM sessions WHERE id = ? AND user_id = ? LIMIT 1",
		[sessionId, numericUserId]
	);
	const session = rows[0];

	if (!session) {
		throw createHttpError(404, "Session not found");
	}

	if (Number(session.is_revoked) === 1) {
		return {
			message: "Session already logged out"
		};
	}

	await withTransaction(async (connection) => {
		await connection.query<ResultSetHeader>(
			"UPDATE sessions SET is_revoked = 1 WHERE id = ? AND user_id = ?",
			[sessionId, numericUserId]
		);

		await connection.query<ResultSetHeader>(
			"UPDATE refresh_tokens SET is_revoked = 1 WHERE session_id = ? AND user_id = ? AND is_revoked = 0",
			[sessionId, numericUserId]
		);
	});

	return {
		message: "Session logged out successfully"
	};
};

export const revokeAllSessions = async (userId: string): Promise<LogoutResult> => {
	const numericUserId = parseUserIdOrThrow(userId);

	await withTransaction(async (connection) => {
		await revokeAllUserSessions(connection, numericUserId);
	});

	return {
		message: "Logged out from all sessions"
	};
};

export const refresh = async (
	refreshToken: string,
	context: LoginContext
): Promise<LoginResult> => {
	const tokenHash = hashToken(refreshToken);

	const [rows] = await pool.query<RefreshTokenRow[]>(
		`
			SELECT
				rt.id AS refresh_id,
				rt.is_revoked AS refresh_is_revoked,
				rt.expires_at AS refresh_expires_at,
				rt.session_id,
				s.is_revoked AS session_is_revoked,
				s.expires_at AS session_expires_at,
				u.id,
				u.orga_id,
				u.company_role,
				u.firstname,
				u.lastname,
				u.email,
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
				u.last_login_at,
				u.email_verified_at,
				u.created_at,
				u.updated_at,
				u.role_id,
				r.name AS role_name
			FROM refresh_tokens rt
			INNER JOIN users u ON u.id = rt.user_id
			LEFT JOIN roles r ON r.id = u.role_id
			LEFT JOIN sessions s ON s.id = rt.session_id
			WHERE rt.token_hash = ?
			LIMIT 1
		`,
		[tokenHash]
	);

	const refreshRow = rows[0];

	if (!refreshRow) {
		throw createHttpError(401, "Invalid refresh token");
	}

	assertUserNotBanned(refreshRow);

	if (refreshRow.refresh_is_revoked === 1 || isExpired(refreshRow.refresh_expires_at)) {
		throw createHttpError(401, "Refresh token is expired or revoked");
	}

	if (
		refreshRow.session_id &&
		(refreshRow.session_is_revoked === 1 || isExpired(refreshRow.session_expires_at))
	) {
		throw createHttpError(401, "Session has expired");
	}

	const newRefreshToken = createRefreshTokenBundle();
	let sessionId = refreshRow.session_id ?? null;

	await withTransaction(async (connection) => {
		await connection.query<ResultSetHeader>(
			"UPDATE refresh_tokens SET is_revoked = 1 WHERE id = ?",
			[refreshRow.refresh_id]
		);

		if (!sessionId) {
			const sessionToken = createSessionToken();
			const [sessionInsertResult] = await connection.query<ResultSetHeader>(
				`
					INSERT INTO sessions (
						user_id,
						session_token,
						ip_address,
						user_agent,
						expires_at,
						last_seen_at
					) VALUES (?, ?, ?, ?, ?, ?)
				`,
				[
					refreshRow.id,
					sessionToken,
					sanitizeOptionalText(context.ipAddress),
					sanitizeOptionalText(context.userAgent),
					newRefreshToken.expiresAt,
					new Date()
				]
			);

			sessionId = Number(sessionInsertResult.insertId);
		} else {
			await connection.query<ResultSetHeader>(
				`
					UPDATE sessions
					SET last_seen_at = ?, expires_at = ?, is_revoked = 0
					WHERE id = ?
				`,
				[new Date(), newRefreshToken.expiresAt, sessionId]
			);
		}

		await connection.query<ResultSetHeader>(
			`
				INSERT INTO refresh_tokens (user_id, session_id, token_hash, expires_at)
				VALUES (?, ?, ?, ?)
			`,
			[refreshRow.id, sessionId, newRefreshToken.tokenHash, newRefreshToken.expiresAt]
		);
	});

	return {
		user: await buildPublicUser(refreshRow, { strictDates: true }),
		tokens: {
			accessToken: createAccessToken({
				userId: refreshRow.id,
				email: refreshRow.email,
				role: refreshRow.role_name ?? "user",
				sessionId
			}),
			refreshToken: newRefreshToken.token,
			tokenType: "Bearer",
			expiresIn: process.env.JWT_EXPIRES_IN ?? "15m"
		}
	};
};

export const verifyEmail = async (
	email: string,
	code: string,
	context: LoginContext
): Promise<VerifyEmailResult> => {
	const normalizedEmail = normalizeEmail(email);
	const user = await getUserByEmail(normalizedEmail);

	if (!user) {
		throw createHttpError(404, "User not found");
	}

	if (user.email_verified_at) {
		return { alreadyVerified: true };
	}

	const [codeRows] = await pool.query<EmailVerificationCodeRow[]>(
		`
			SELECT id, user_id, code_hash, expires_at, used_at
			FROM email_verification_codes
			WHERE user_id = ?
			ORDER BY id DESC
			LIMIT 1
		`,
		[user.id]
	);

	const latestCode = codeRows[0];

	if (!latestCode || latestCode.used_at) {
		throw createHttpError(400, "Verification code is invalid");
	}

	if (isExpired(latestCode.expires_at)) {
		throw createHttpError(400, "Verification code has expired");
	}

	if (latestCode.code_hash !== hashToken(code)) {
		throw createHttpError(400, "Verification code is invalid");
	}

	await withTransaction(async (connection) => {
		await connection.query<ResultSetHeader>(
			"UPDATE email_verification_codes SET used_at = ? WHERE id = ?",
			[new Date(), latestCode.id]
		);

		await connection.query<ResultSetHeader>("UPDATE users SET email_verified_at = ? WHERE id = ?", [
			new Date(),
			user.id
		]);
	});

	const refreshedUser = await getUserById(user.id);

	if (!refreshedUser) {
		throw createHttpError(500, "Failed to load verified user");
	}

	return {
		alreadyVerified: false,
		user: await buildPublicUser(refreshedUser, { strictDates: true }),
		tokens: await createSessionAndTokens(refreshedUser, context)
	};
};

export const resendVerification = async (
	email: string
): Promise<ResendVerificationResult> => {
	const normalizedEmail = normalizeEmail(email);
	const user = await getUserByEmail(normalizedEmail);

	if (!user || user.email_verified_at || !user.email) {
		return {};
	}

	const code = await createAndSendEmailVerificationCode(user);
	return { code };
};

export const forgotPassword = async (email: string): Promise<ForgotPasswordResult> => {
	const normalizedEmail = normalizeEmail(email);
	const user = await getUserByEmail(normalizedEmail);

	if (!user || !user.email || !(await hasLocalAuthProvider(user.id))) {
		return {};
	}

	const resetToken = createPasswordResetToken(user.id, normalizedEmail);
	const resetUrl = buildPasswordResetUrl(resetToken);
	const sent = await sendEmail({
		to: user.email,
		subject: "Réinitialisation du mot de passe Starz",
		text: resetUrl
			? `Cliquez sur ce lien pour réinitialiser votre mot de passe: ${resetUrl}`
			: `Utilisez ce jeton pour réinitialiser votre mot de passe: ${resetToken}`
	});

	if (!sent && process.env.NODE_ENV === "production") {
		throw createHttpError(500, "Email provider is not configured");
	}

	return { token: getDebugToken(resetToken) };
};

export const resetPassword = async (token: string, newPassword: string): Promise<void> => {
	const { userId, email } = verifyPasswordResetToken(token);
	const user = await getUserById(userId);

	if (!user) {
		throw createHttpError(404, "User not found");
	}

	if (!user.email || normalizeEmail(user.email) !== normalizeEmail(email)) {
		throw createHttpError(400, "Reset token is no longer valid");
	}

	if (!(await hasLocalAuthProvider(user.id))) {
		throw createHttpError(400, "Account does not use local password authentication");
	}

	const passwordHash = await bcrypt.hash(newPassword, 12);

	await withTransaction(async (connection) => {
		await connection.query<ResultSetHeader>("UPDATE users SET password_hash = ? WHERE id = ?", [
			passwordHash,
			userId
		]);

		await revokeAllUserSessions(connection, userId);
	});
};

const authService = {
	register,
	login,
	getOAuthAuthorizationUrl,
	oauthCallback,
	logout,
	listSessions,
	revokeSession,
	revokeAllSessions,
	refresh,
	verifyEmail,
	resendVerification,
	forgotPassword,
	resetPassword
};

export type { LogoutPayload, LoginContext };

export default authService;
