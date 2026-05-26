import {api, setAccessToken} from "@/lib/axios";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";

export type RegisterPayload = {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    status?: "en_recherche" | "recruteur";
};

export type LoginPayload = {
    email: string;
    password: string;
};

export type AccountSession = {
    id: number;
    ipAddress: string | null;
    userAgent: string | null;
    expiresAt: string;
    lastSeenAt: string | null;
    createdAt: string;
    isCurrentSession: boolean;
};

export const register = async (payload: RegisterPayload) => {
    const response = await api.post("/auth/register", payload);
    return response.data.data;
};

export const login = async (payload: LoginPayload) => {
    const response = await api.post("/auth/login", payload);
    const token = response.data.data.tokens.accessToken as string;

    setAccessToken(token);
    setSessionCookie();

    return response.data.data;
};

export const logout = async () => {
    try {
        await api.post("/auth/logout");
    } finally {
        setAccessToken(null);
        clearSessionCookie();
    }
};

export const forgotPassword = async (email: string) => {
    const response = await api.post("/auth/forgot-password", { email });
    return response.data.data as { token?: string };
};

export const resetPassword = async (token: string, newPassword: string) => {
    await api.post("/auth/reset-password", { token, newPassword });
};

export const listSessions = async () => {
    const response = await api.get("/auth/sessions");
    return response.data.data.sessions as AccountSession[];
};

export const revokeSession = async (sessionId: number) => {
    await api.delete(`/auth/sessions/${sessionId}`);
};

export const revokeAllSessions = async () => {
    await api.delete("/auth/sessions");
};

export const getMe = async () => {
    const response = await api.get("/auth/me");
    return response.data.data.user;
};

export type OAuthProvider = "google" | "github" | "linkedin";

export const oauthGetUrl = async (
    provider: OAuthProvider,
    redirectUri: string,
    state?: string
): Promise<string> => {
    const response = await api.get(`/auth/oauth/${provider}/url`, {
        params: { redirectUri, state },
    });
    return response.data.data.url as string;
};

export const verifyEmail = async (email: string, code: string) => {
    const response = await api.post("/auth/verify-email", { email, code });
    const token = response.data.data.tokens?.accessToken as string | undefined;

    if (token) {
        setAccessToken(token);
        setSessionCookie();
    }

    return response.data.data;
};

export const resendVerification = async (email: string) => {
    const response = await api.post("/auth/resend-verification", { email });
    return response.data.data;
};

export const oauthLogin = async (
    provider: OAuthProvider,
    code: string,
    redirectUri: string
) => {
    const response = await api.post(`/auth/oauth/${provider}`, {
        code,
        redirectUri,
    });
    const token = response.data.data.tokens.accessToken as string;

    setAccessToken(token);
    setSessionCookie();

    return response.data.data;
};
