import createHttpError from "./httpError";

export type OAuthProvider = "google" | "github" | "linkedin";

interface OAuthAuthorizationUrlPayload {
	redirectUri: string;
	state?: string;
}

interface OAuthCallbackPayload {
	code: string;
	redirectUri: string;
}

export interface OAuthProfile {
	providerId: string;
	email: string;
	firstName: string;
	lastName: string;
}

interface OAuthClientConfig {
	clientId: string;
	clientSecret: string;
}

const OAUTH_AUTHORIZE_URLS: Record<OAuthProvider, string> = {
	google: "https://accounts.google.com/o/oauth2/v2/auth",
	github: "https://github.com/login/oauth/authorize",
	linkedin: "https://www.linkedin.com/oauth/v2/authorization"
};

const OAUTH_SCOPES: Record<OAuthProvider, string> = {
	google: "openid email profile",
	github: "read:user user:email",
	linkedin: "openid profile email"
};

const getAllowedRedirectUris = (): string[] =>
	String(process.env.OAUTH_ALLOWED_REDIRECT_URIS ?? "")
		.split(",")
		.map((uri) => uri.trim())
		.filter(Boolean);

const assertRedirectUriAllowed = (redirectUri: string): void => {
	const allowedRedirectUris = getAllowedRedirectUris();

	if (allowedRedirectUris.length === 0 && process.env.NODE_ENV !== "production") {
		return;
	}

	if (!allowedRedirectUris.includes(redirectUri)) {
		throw createHttpError(400, "OAuth redirectUri is not allowed");
	}
};

const splitName = (fullName: string): { firstName: string; lastName: string } => {
	const normalized = fullName.trim();

	if (!normalized) {
		return { firstName: "User", lastName: "OAuth" };
	}

	const parts = normalized.split(/\s+/);
	const firstName = parts[0] ?? "User";
	const lastName = parts.slice(1).join(" ") || "OAuth";
	return { firstName, lastName };
};

const getOAuthClientConfig = (provider: OAuthProvider): OAuthClientConfig => {
	const key = provider.toUpperCase();
	const clientId = process.env[`${key}_CLIENT_ID`]?.trim();
	const clientSecret = process.env[`${key}_CLIENT_SECRET`]?.trim();

	if (!clientId || !clientSecret) {
		throw createHttpError(500, `${key}_CLIENT_ID and ${key}_CLIENT_SECRET must be configured`);
	}

	return { clientId, clientSecret };
};

const toFormBody = (values: Record<string, string>): string => {
	return new URLSearchParams(values).toString();
};

const parseTokenResponse = async (response: Response): Promise<Record<string, unknown>> => {
	const rawText = await response.text();

	try {
		return JSON.parse(rawText) as Record<string, unknown>;
	} catch (_error) {
		const params = new URLSearchParams(rawText);
		return Object.fromEntries(params.entries());
	}
};

const fetchAccessToken = async (
	provider: OAuthProvider,
	{ code, redirectUri }: OAuthCallbackPayload
): Promise<string> => {
	const { clientId, clientSecret } = getOAuthClientConfig(provider);
	assertRedirectUriAllowed(redirectUri);

	const tokenUrl =
		provider === "google"
			? "https://oauth2.googleapis.com/token"
			: provider === "github"
				? "https://github.com/login/oauth/access_token"
				: "https://www.linkedin.com/oauth/v2/accessToken";

	const tokenResponse = await fetch(tokenUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Accept: "application/json"
		},
		body: toFormBody({
			grant_type: "authorization_code",
			code,
			redirect_uri: redirectUri,
			client_id: clientId,
			client_secret: clientSecret
		})
	});

	const payload = await parseTokenResponse(tokenResponse);
	const accessToken = payload.access_token;

	if (!tokenResponse.ok || typeof accessToken !== "string" || accessToken.length === 0) {
		throw createHttpError(401, `Unable to authenticate with ${provider}`);
	}

	return accessToken;
};

const fetchGoogleProfile = async (accessToken: string): Promise<OAuthProfile> => {
	const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	const payload = (await response.json()) as Record<string, unknown>;

	const providerId = typeof payload.sub === "string" ? payload.sub : "";
	const email = typeof payload.email === "string" ? payload.email : "";
	const firstName =
		typeof payload.given_name === "string" && payload.given_name.trim().length > 0
			? payload.given_name.trim()
			: splitName(typeof payload.name === "string" ? payload.name : "").firstName;
	const lastName =
		typeof payload.family_name === "string" && payload.family_name.trim().length > 0
			? payload.family_name.trim()
			: splitName(typeof payload.name === "string" ? payload.name : "").lastName;

	if (!response.ok || !providerId || !email) {
		throw createHttpError(401, "Unable to read Google profile");
	}

	return { providerId, email, firstName, lastName };
};

const fetchGithubEmail = async (accessToken: string): Promise<string> => {
	const response = await fetch("https://api.github.com/user/emails", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
			"User-Agent": "starz-backend"
		}
	});
	const payload = (await response.json()) as Array<Record<string, unknown>>;

	if (!response.ok || !Array.isArray(payload)) {
		return "";
	}

	const primaryVerified = payload.find(
		(item) => item.primary === true && item.verified === true && typeof item.email === "string"
	);

	if (primaryVerified && typeof primaryVerified.email === "string") {
		return primaryVerified.email;
	}

	const anyVerified = payload.find(
		(item) => item.verified === true && typeof item.email === "string"
	);
	if (anyVerified && typeof anyVerified.email === "string") {
		return anyVerified.email;
	}

	return "";
};

const fetchGithubProfile = async (accessToken: string): Promise<OAuthProfile> => {
	const response = await fetch("https://api.github.com/user", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
			"User-Agent": "starz-backend"
		}
	});
	const payload = (await response.json()) as Record<string, unknown>;

	const providerId =
		typeof payload.id === "number" || typeof payload.id === "string" ? String(payload.id) : "";
	const name = typeof payload.name === "string" ? payload.name : "";
	const login = typeof payload.login === "string" ? payload.login : "github-user";
	const inferredName = name.trim().length > 0 ? name : login;
	const { firstName, lastName } = splitName(inferredName);
	const emailFromUser = typeof payload.email === "string" ? payload.email : "";
	const email = emailFromUser || (await fetchGithubEmail(accessToken));

	if (!response.ok || !providerId || !email) {
		throw createHttpError(401, "Unable to read GitHub profile");
	}

	return { providerId, email, firstName, lastName };
};

const fetchLinkedinProfile = async (accessToken: string): Promise<OAuthProfile> => {
	const response = await fetch("https://api.linkedin.com/v2/userinfo", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json"
		}
	});
	const payload = (await response.json()) as Record<string, unknown>;

	const providerId = typeof payload.sub === "string" ? payload.sub : "";
	const email = typeof payload.email === "string" ? payload.email : "";
	const name = typeof payload.name === "string" ? payload.name : "";
	const firstName =
		typeof payload.given_name === "string" && payload.given_name.trim().length > 0
			? payload.given_name.trim()
			: splitName(name).firstName;
	const lastName =
		typeof payload.family_name === "string" && payload.family_name.trim().length > 0
			? payload.family_name.trim()
			: splitName(name).lastName;

	if (!response.ok || !providerId || !email) {
		throw createHttpError(401, "Unable to read LinkedIn profile");
	}

	return { providerId, email, firstName, lastName };
};

export const getOAuthAuthorizationUrl = (
	provider: OAuthProvider,
	{ redirectUri, state }: OAuthAuthorizationUrlPayload
): string => {
	const { clientId } = getOAuthClientConfig(provider);
	assertRedirectUriAllowed(redirectUri);
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: "code",
		scope: OAUTH_SCOPES[provider]
	});

	if (state) {
		params.set("state", state);
	}

	return `${OAUTH_AUTHORIZE_URLS[provider]}?${params.toString()}`;
};

export const fetchOAuthProfile = async (
	provider: OAuthProvider,
	payload: OAuthCallbackPayload
): Promise<OAuthProfile> => {
	const accessToken = await fetchAccessToken(provider, payload);

	if (provider === "google") {
		return fetchGoogleProfile(accessToken);
	}

	if (provider === "github") {
		return fetchGithubProfile(accessToken);
	}

	return fetchLinkedinProfile(accessToken);
};
