import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import createHttpError from "./httpError";

export const getAuthenticatedUserId = (req: AuthenticatedRequest): string => {
	const userId = req.auth?.userId;

	if (!userId) {
		throw createHttpError(401, "Unauthorized");
	}

	return userId;
};

export const getAuthenticatedNumericUserId = (req: AuthenticatedRequest): number => {
	const userId = Number(getAuthenticatedUserId(req));

	if (!Number.isInteger(userId) || userId <= 0) {
		throw createHttpError(401, "Unauthorized");
	}

	return userId;
};

export const getAuthenticatedSessionId = (req: AuthenticatedRequest): number => {
	const sessionId = req.auth?.sessionId;

	if (!sessionId) {
		throw createHttpError(401, "Unauthorized");
	}

	return sessionId;
};
