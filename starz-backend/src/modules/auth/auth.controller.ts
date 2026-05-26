import type { Request } from "express";

import asyncHandler from "../../helpers/asyncHandler";
import createHttpError from "../../helpers/httpError";
import {
	clearRefreshTokenCookie,
	getRefreshTokenFromRequest,
	setRefreshTokenCookie
} from "../../helpers/refreshTokenCookie";
import {
	getAuthenticatedSessionId,
	getAuthenticatedUserId
} from "../../helpers/requestAuth";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import authService, { type LoginContext } from "./auth.service";
import type {
	EmailPayload,
	LoginPayload,
	LogoutPayloadBody,
	OAuthAuthorizeQuery,
	OAuthCallbackPayload,
	OAuthProviderParams,
	RefreshPayload,
	RegisterPayload,
	ResetPasswordPayload,
	SessionIdParams,
	VerifyEmailPayload
} from "./auth.schemas";

const getLoginContext = (req: Request): LoginContext => ({
	ipAddress: req.ip,
	userAgent: req.headers["user-agent"]
});

type AuthResult = Awaited<ReturnType<typeof authService.login>>;
type ResultWithTokens = { tokens: AuthResult["tokens"] };

const hideRefreshToken = <T extends ResultWithTokens>(result: T) => {
	const { refreshToken: _refreshToken, ...tokens } = result.tokens;

	return {
		...result,
		tokens
	};
};

export const register = asyncHandler(async (req, res) => {
	const payload = req.body as RegisterPayload;
	const result = await authService.register(payload);

	res.status(201).json({
		success: true,
		message: "Account created successfully",
		data: result
	});
});

export const login = asyncHandler(async (req, res) => {
	const payload = req.body as LoginPayload;
	const result = await authService.login(payload, getLoginContext(req));
	setRefreshTokenCookie(res, result.tokens.refreshToken);

	res.status(200).json({
		success: true,
		message: "Authenticated successfully",
		data: hideRefreshToken(result)
	});
});

export const oauthAuthorize = asyncHandler(async (req, res) => {
	const { provider } = req.params as unknown as OAuthProviderParams;
	const query = req.query as unknown as OAuthAuthorizeQuery;
	const result = await authService.getOAuthAuthorizationUrl(provider, query);

	res.status(200).json({
		success: true,
		message: "OAuth URL generated",
		data: result
	});
});

export const oauthCallback = asyncHandler(async (req, res) => {
	const { provider } = req.params as unknown as OAuthProviderParams;
	const payload = req.body as OAuthCallbackPayload;
	const result = await authService.oauthCallback(provider, payload, getLoginContext(req));
	setRefreshTokenCookie(res, result.tokens.refreshToken);

	res.status(200).json({
		success: true,
		message: "Authenticated successfully",
		data: hideRefreshToken(result)
	});
});

export const logout = asyncHandler(async (req, res) => {
	const authReq = req as AuthenticatedRequest;
	const payload = req.body as LogoutPayloadBody;
	const refreshToken = payload.refreshToken ?? getRefreshTokenFromRequest(req);
	const result = await authService.logout({
		userId: getAuthenticatedUserId(authReq),
		refreshToken,
		sessionId: getAuthenticatedSessionId(authReq)
	});
	clearRefreshTokenCookie(res);

	res.status(200).json({
		success: true,
		message: result.message
	});
});

export const refresh = asyncHandler(async (req, res) => {
	const { refreshToken: bodyRefreshToken } = req.body as RefreshPayload;
	const refreshToken = bodyRefreshToken ?? getRefreshTokenFromRequest(req);

	if (!refreshToken) {
		throw createHttpError(401, "Missing refresh token");
	}

	const result = await authService.refresh(refreshToken, getLoginContext(req));
	setRefreshTokenCookie(res, result.tokens.refreshToken);

	res.status(200).json({
		success: true,
		message: "Token refreshed successfully",
		data: hideRefreshToken(result)
	});
});

export const getSessions = asyncHandler(async (req, res) => {
	const authReq = req as AuthenticatedRequest;
	const result = await authService.listSessions(
		getAuthenticatedUserId(authReq),
		getAuthenticatedSessionId(authReq)
	);

	res.status(200).json({
		success: true,
		message: "Sessions fetched successfully",
		data: result
	});
});

export const deleteSession = asyncHandler(async (req, res) => {
	const { sessionId } = req.params as unknown as SessionIdParams;
	const result = await authService.revokeSession(
		getAuthenticatedUserId(req as AuthenticatedRequest),
		sessionId
	);

	res.status(200).json({
		success: true,
		message: result.message
	});
});

export const deleteSessions = asyncHandler(async (req, res) => {
	const result = await authService.revokeAllSessions(
		getAuthenticatedUserId(req as AuthenticatedRequest)
	);

	res.status(200).json({
		success: true,
		message: result.message
	});
});

export const verifyEmail = asyncHandler(async (req, res) => {
	const { email, code } = req.body as VerifyEmailPayload;
	const result = await authService.verifyEmail(email, code, getLoginContext(req));

	if (result.tokens) {
		setRefreshTokenCookie(res, result.tokens.refreshToken);
	}

	res.status(200).json({
		success: true,
		message: result.alreadyVerified ? "Email is already verified" : "Email verified successfully",
		data: result.tokens ? hideRefreshToken({ ...result, tokens: result.tokens }) : result
	});
});

export const resendVerification = asyncHandler(async (req, res) => {
	const { email } = req.body as EmailPayload;
	const result = await authService.resendVerification(email);

	res.status(200).json({
		success: true,
		message: "If the account exists, a verification email has been sent",
		data: result
	});
});

export const forgotPassword = asyncHandler(async (req, res) => {
	const { email } = req.body as EmailPayload;
	const result = await authService.forgotPassword(email);

	res.status(200).json({
		success: true,
		message: "If the account exists, a reset email has been sent",
		data: result
	});
});

export const resetPassword = asyncHandler(async (req, res) => {
	const { token, newPassword } = req.body as ResetPasswordPayload;
	await authService.resetPassword(token, newPassword);

	res.status(200).json({
		success: true,
		message: "Password reset successfully"
	});
});

const authController = {
	register,
	login,
	oauthAuthorize,
	oauthCallback,
	logout,
	refresh,
	getSessions,
	deleteSession,
	deleteSessions,
	verifyEmail,
	resendVerification,
	forgotPassword,
	resetPassword
};

export default authController;
