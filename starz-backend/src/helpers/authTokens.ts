import crypto from "node:crypto";

import { parsePositiveInteger } from "./env";
import createHttpError from "./httpError";

const jwt = require("jsonwebtoken");

type JwtClaims = Record<string, unknown>;

interface AccessTokenParams {
	userId: number;
	email: string | null;
	role?: string;
	sessionId?: number | null;
}

interface TokenVerificationResult {
	userId: number;
	email: string;
}

interface RefreshTokenBundle {
	token: string;
	tokenHash: string;
	expiresAt: Date;
}

const toOptionalString = (value: unknown): string | undefined => {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmedValue = value.trim();
	return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const toRequiredEmail = (value: unknown, message: string): string => {
	const email = toOptionalString(value);

	if (!email) {
		throw createHttpError(400, message);
	}

	return email;
};

const toRequiredUserId = (value: unknown, message: string): number => {
	const numericValue = Number(value);

	if (!Number.isInteger(numericValue) || numericValue <= 0) {
		throw createHttpError(400, message);
	}

	return numericValue;
};

const getJwtSecret = (): string => {
	const jwtSecret = process.env.JWT_SECRET?.trim();

	if (!jwtSecret) {
		throw createHttpError(500, "JWT_SECRET is not configured");
	}

	return jwtSecret;
};

const verifyJwt = (token: string): JwtClaims => {
	try {
		const decodedToken = jwt.verify(token, getJwtSecret()) as JwtClaims | string;
		return typeof decodedToken === "string" ? { sub: decodedToken } : decodedToken;
	} catch (_error) {
		throw createHttpError(401, "Invalid or expired token");
	}
};

const addDays = (date: Date, numberOfDays: number): Date => {
	const clonedDate = new Date(date);
	clonedDate.setDate(clonedDate.getDate() + numberOfDays);
	return clonedDate;
};

export const generateSecureToken = (size = 32): string => {
	return crypto.randomBytes(size).toString("hex");
};

export const hashToken = (token: string): string => {
	return crypto.createHash("sha256").update(token).digest("hex");
};

export const createRefreshTokenBundle = (): RefreshTokenBundle => {
	const refreshTokenTtlInDays = parsePositiveInteger(process.env.REFRESH_TOKEN_TTL_DAYS, 30);
	const token = generateSecureToken(48);

	return {
		token,
		tokenHash: hashToken(token),
		expiresAt: addDays(new Date(), refreshTokenTtlInDays)
	};
};

export const createAccessToken = ({
	userId,
	email,
	role,
	sessionId
}: AccessTokenParams): string => {
	return jwt.sign(
		{
			sub: String(userId),
			email: email ?? undefined,
			role: role ?? undefined,
			sessionId: sessionId ?? undefined,
			tokenType: "access"
		},
		getJwtSecret(),
		{ expiresIn: process.env.JWT_EXPIRES_IN ?? "15m" }
	);
};

export const createPasswordResetToken = (userId: number, email: string): string => {
	return jwt.sign(
		{
			sub: String(userId),
			email,
			purpose: "password_reset",
			tokenType: "action"
		},
		getJwtSecret(),
		{ expiresIn: process.env.RESET_PASSWORD_EXPIRES_IN ?? "30m" }
	);
};

const verifyActionToken = (token: string, expectedPurpose: string): TokenVerificationResult => {
	const claims = verifyJwt(token);

	if (claims.purpose !== expectedPurpose) {
		throw createHttpError(400, "Token purpose is invalid");
	}

	return {
		userId: toRequiredUserId(claims.sub, "Token subject is invalid"),
		email: toRequiredEmail(claims.email, "Token email is invalid")
	};
};

export const verifyPasswordResetToken = (token: string): TokenVerificationResult => {
	return verifyActionToken(token, "password_reset");
};
