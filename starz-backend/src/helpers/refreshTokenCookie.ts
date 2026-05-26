import type { CookieOptions, Request, Response } from "express";

import { parsePositiveInteger } from "./env";

export const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

const parseSameSite = (): CookieOptions["sameSite"] => {
	const sameSite = process.env.REFRESH_TOKEN_COOKIE_SAME_SITE?.toLowerCase();

	if (sameSite === "strict" || sameSite === "none") {
		return sameSite;
	}

	return "lax";
};

const getRefreshTokenCookieOptions = (): CookieOptions => {
	const sameSite = parseSameSite();
	const options: CookieOptions = {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production" || sameSite === "none",
		sameSite,
		path: "/auth",
		maxAge: parsePositiveInteger(process.env.REFRESH_TOKEN_TTL_DAYS, 30) * 24 * 60 * 60 * 1000
	};

	if (process.env.REFRESH_TOKEN_COOKIE_DOMAIN) {
		options.domain = process.env.REFRESH_TOKEN_COOKIE_DOMAIN;
	}

	return options;
};

export const getCookieValue = (req: Request, cookieName: string): string | undefined => {
	const cookieHeader = req.headers.cookie;

	if (!cookieHeader) {
		return undefined;
	}

	const cookies = cookieHeader.split(";");

	for (const cookie of cookies) {
		const separatorIndex = cookie.indexOf("=");

		if (separatorIndex === -1) {
			continue;
		}

		const name = cookie.slice(0, separatorIndex).trim();

		if (name !== cookieName) {
			continue;
		}

		const value = cookie.slice(separatorIndex + 1).trim();

		try {
			return decodeURIComponent(value);
		} catch (_error) {
			return value;
		}
	}

	return undefined;
};

export const getRefreshTokenFromRequest = (req: Request): string | undefined =>
	getCookieValue(req, REFRESH_TOKEN_COOKIE_NAME);

export const setRefreshTokenCookie = (res: Response, refreshToken: string): void => {
	res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getRefreshTokenCookieOptions());
};

export const clearRefreshTokenCookie = (res: Response): void => {
	const { maxAge: _maxAge, ...options } = getRefreshTokenCookieOptions();
	res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, options);
};
