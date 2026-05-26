const express = require("express");

import authMiddleware from "../../middlewares/auth.middleware";
import { parsePositiveInteger } from "../../helpers/env";
import createRateLimiter from "../../middlewares/rateLimit.middleware";
import { validate, validateBody } from "../../middlewares/validate.middleware";
import authController from "./auth.controller";
import {
	emailPayloadSchema,
	loginPayloadSchema,
	logoutPayloadSchema,
	oauthAuthorizeQuerySchema,
	oauthCallbackPayloadSchema,
	oauthProviderParamsSchema,
	refreshPayloadSchema,
	registerPayloadSchema,
	resetPasswordPayloadSchema,
	sessionIdParamsSchema,
	verifyEmailPayloadSchema
} from "./auth.schemas";

const router = express.Router();

const authWindowMs = parsePositiveInteger(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 60_000);
const registerRateLimiter = createRateLimiter({
	windowMs: authWindowMs,
	maxRequests: parsePositiveInteger(process.env.AUTH_RATE_LIMIT_REGISTER_MAX, 5),
	keyPrefix: "auth:register"
});
const loginRateLimiter = createRateLimiter({
	windowMs: authWindowMs,
	maxRequests: parsePositiveInteger(process.env.AUTH_RATE_LIMIT_LOGIN_MAX, 10),
	keyPrefix: "auth:login"
});
const refreshRateLimiter = createRateLimiter({
	windowMs: authWindowMs,
	maxRequests: parsePositiveInteger(process.env.AUTH_RATE_LIMIT_REFRESH_MAX, 20),
	keyPrefix: "auth:refresh"
});
const oauthRateLimiter = createRateLimiter({
	windowMs: authWindowMs,
	maxRequests: parsePositiveInteger(process.env.AUTH_RATE_LIMIT_OAUTH_MAX, 20),
	keyPrefix: "auth:oauth"
});
const actionRateLimiter = createRateLimiter({
	windowMs: authWindowMs,
	maxRequests: parsePositiveInteger(process.env.AUTH_RATE_LIMIT_ACTION_MAX, 10),
	keyPrefix: "auth:actions"
});

router.post("/register", registerRateLimiter, validateBody(registerPayloadSchema), authController.register);
router.post("/login", loginRateLimiter, validateBody(loginPayloadSchema), authController.login);
router.get(
	"/oauth/:provider/url",
	oauthRateLimiter,
	validate({ params: oauthProviderParamsSchema, query: oauthAuthorizeQuerySchema }),
	authController.oauthAuthorize
);
router.post(
	"/oauth/:provider",
	oauthRateLimiter,
	validate({ params: oauthProviderParamsSchema, body: oauthCallbackPayloadSchema }),
	authController.oauthCallback
);
router.post("/logout", authMiddleware, validateBody(logoutPayloadSchema), authController.logout);
router.post("/refresh", refreshRateLimiter, validateBody(refreshPayloadSchema), authController.refresh);
router.get("/sessions", authMiddleware, authController.getSessions);
router.delete(
	"/sessions/:sessionId",
	authMiddleware,
	validate({ params: sessionIdParamsSchema }),
	authController.deleteSession
);
router.delete("/sessions", authMiddleware, authController.deleteSessions);
router.post(
	"/verify-email",
	actionRateLimiter,
	validateBody(verifyEmailPayloadSchema),
	authController.verifyEmail
);
router.post(
	"/resend-verification",
	actionRateLimiter,
	validateBody(emailPayloadSchema),
	authController.resendVerification
);
router.post(
	"/forgot-password",
	actionRateLimiter,
	validateBody(emailPayloadSchema),
	authController.forgotPassword
);
router.post(
	"/reset-password",
	actionRateLimiter,
	validateBody(resetPasswordPayloadSchema),
	authController.resetPassword
);

export const basePath = "/auth";
export default router;
