"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { oauthLogin, type OAuthProvider } from "@/features/auth/auth.api";
import { api } from "@/lib/axios";

const VALID_PROVIDERS: OAuthProvider[] = ["google", "github", "linkedin"];
const VALID_OAUTH_MODES = new Set(["login", "link"]);

type OAuthState = {
    provider?: string;
    mode?: "login" | "link";
    redirectTo?: string;
};

const isSafeInternalRedirect = (value: string): boolean =>
    value.startsWith("/") && !value.startsWith("//");

const readOAuthState = (rawState: string | null): OAuthState => {
    if (!rawState) {
        return {};
    }

    try {
        const parsed = JSON.parse(rawState) as OAuthState;
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
};

function OAuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const params = useParams();
    const processed = useRef(false);

    useEffect(() => {
        if (processed.current) return;
        processed.current = true;

        const provider = params.provider as string;
        const code = searchParams.get("code");
        const state = readOAuthState(searchParams.get("state"));

        if (!code || !VALID_PROVIDERS.includes(provider as OAuthProvider)) {
            router.replace("/auth/login");
            return;
        }

        const redirectUri = `${window.location.origin}/auth/callback/${provider}`;
        const destination =
            typeof state.redirectTo === "string" && isSafeInternalRedirect(state.redirectTo)
                ? state.redirectTo
                : sessionStorage.getItem("oauth_redirect") ?? "/";
        const mode = VALID_OAUTH_MODES.has(state.mode ?? "") ? state.mode : "login";

        sessionStorage.removeItem("oauth_redirect");

        const request =
            mode === "link"
                ? api.post(`/me/oauth/${provider}`, { code, redirectUri })
                : oauthLogin(provider as OAuthProvider, code, redirectUri);

        request
            .then(() => router.replace(destination))
            .catch(() =>
                router.replace(mode === "link" ? "/profile?error=oauth" : "/auth/login?error=oauth")
            );
    }, [router, searchParams, params]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <p className="text-black/50 text-sm">Connexion en cours...</p>
        </div>
    );
}

export default function OAuthCallback() {
    return (
        <Suspense
        fallback={
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-black/50 text-sm">Connexion en cours...</p>
            </div>
        }
        >
            <OAuthCallbackContent />
        </Suspense>
    );
}
