import type { NextFunction, Request, Response } from "express";
import type { RowDataPacket } from "mysql2/promise";

import pool from "../config/database";

const jwt = require("jsonwebtoken");

type JwtClaims = Record<string, unknown>;

export interface AuthContext {
	token: string;
	claims: JwtClaims;
	userId?: string;
	email?: string;
	role?: string;
	sessionId?: number;
}

export interface AuthenticatedRequest extends Request {
	auth?: AuthContext;
}

const getBearerToken = (authorizationHeader?: string): string | null => {
	if (!authorizationHeader) {
		return null;
	}

	const [scheme, token] = authorizationHeader.split(" ");

	if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
		return null;
	}

	return token.trim();
};

const sendUnauthorized = (res: Response): void => {
	res.status(401).json({
		success: false,
		message: "Invalid or expired token"
	});
};

const toOptionalString = (value: unknown): string | undefined => {
	if (typeof value === "string" && value.length > 0) {
		return value;
	}

	if (typeof value === "number") {
		return String(value);
	}

	return undefined;
};

const toOptionalPositiveNumber = (value: unknown): number | undefined => {
	const numericValue = Number(value);

	if (!Number.isInteger(numericValue) || numericValue <= 0) {
		return undefined;
	}

	return numericValue;
};

const isAccessTokenClaim = (claims: JwtClaims): boolean => {
	if (!Object.prototype.hasOwnProperty.call(claims, "tokenType")) {
		return true;
	}

	return claims.tokenType === "access";
};

interface SessionRow extends RowDataPacket {
	id: number;
	is_revoked: number;
	expires_at: Date | string;
	banned_at: Date | string | null;
}

const isExpired = (value: Date | string): boolean => {
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) || date.getTime() <= Date.now();
};

const isSessionActive = async (sessionId: number, userId: string): Promise<boolean> => {
	const [rows] = await pool.query<SessionRow[]>(
		`
			SELECT s.id, s.is_revoked, s.expires_at, u.banned_at
			FROM sessions s
			INNER JOIN users u ON u.id = s.user_id
			WHERE s.id = ? AND s.user_id = ?
			LIMIT 1
		`,
		[sessionId, Number(userId)]
	);

	const session = rows[0];

	if (!session) {
		return false;
	}

	if (session.is_revoked === 1) {
		return false;
	}

	if (session.banned_at !== null) {
		return false;
	}

	if (isExpired(session.expires_at)) {
		return false;
	}

	return true;
};

const authMiddleware = async (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction
): Promise<void> => {
	const token = getBearerToken(req.headers.authorization);

	if (!token) {
		res.status(401).json({
			success: false,
			message: "Missing or invalid Authorization header"
		});
		return;
	}

	const jwtSecret = process.env.JWT_SECRET;

	if (!jwtSecret) {
		res.status(500).json({
			success: false,
			message:
				process.env.NODE_ENV === "production"
					? "Internal server error"
					: "JWT_SECRET is not configured"
		});
		return;
	}

	try {
		const decodedToken = jwt.verify(token, jwtSecret) as JwtClaims | string;
		const claims: JwtClaims =
			typeof decodedToken === "string" ? { sub: decodedToken } : decodedToken;

		if (!isAccessTokenClaim(claims)) {
			sendUnauthorized(res);
			return;
		}

		const userId = toOptionalString(claims.sub);
		const sessionId = toOptionalPositiveNumber(claims.sessionId);

		if (!userId || !sessionId) {
			sendUnauthorized(res);
			return;
		}

		const sessionActive = await isSessionActive(sessionId, userId);

		if (!sessionActive) {
			sendUnauthorized(res);
			return;
		}

		req.auth = {
			token,
			claims,
			userId,
			email: toOptionalString(claims.email),
			role: toOptionalString(claims.role),
			sessionId
		};

		next();
	} catch (_error) {
		sendUnauthorized(res);
	}
};

export default authMiddleware;
