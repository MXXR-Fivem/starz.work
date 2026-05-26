import axios, {
    AxiosError,
    type AxiosRequestConfig,
    type InternalAxiosRequestConfig,
} from "axios";
import { clearSessionCookie } from "./session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const ACCESS_TOKEN_STORAGE_KEY = "starz_access_token";

const readPersistedAccessToken = (): string | null => {
    if (typeof window === "undefined") {
        return null;
    }

    return window.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
};

let accessToken: string | null = readPersistedAccessToken();
let refreshPromise: Promise<string | null> | null = null;

export const setAccessToken = (token: string | null) => {
    accessToken = token;

    if (typeof window === "undefined") {
        return;
    }

    if (token) {
        window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
        return;
    }

    window.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
};

export const getAccessToken = () => accessToken;

export const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
});

const refreshAccessToken = async (): Promise<string | null> => {
    if (!refreshPromise) {
        refreshPromise = api
            .post("/auth/refresh")
            .then((response) => {
                const newAccessToken = response.data.data.tokens.accessToken as string;
                setAccessToken(newAccessToken);
                return newAccessToken;
            })
            .catch(() => {
                setAccessToken(null);
                clearSessionCookie();
                return null;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
};

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as
        | (AxiosRequestConfig & { _retry?: boolean })
        | undefined;

        if (
            error.response?.status !== 401 ||
            !originalRequest ||
            originalRequest._retry ||
            originalRequest.url?.includes("/auth/login") ||
            originalRequest.url?.includes("/auth/register") ||
            originalRequest.url?.includes("/auth/refresh")
        ) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        const newAccessToken = await refreshAccessToken();

        if (!newAccessToken) {
            return Promise.reject(error);
        }

        originalRequest.headers = {
            ...originalRequest.headers,
            Authorization: `Bearer ${newAccessToken}`,
        };

        return api(originalRequest);
    }
);
