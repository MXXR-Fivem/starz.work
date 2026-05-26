"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/axios";
import type { OAuthProvider } from "@/features/auth/auth.api";

export default function ProfileOAuthCallback() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const provider = params.provider as OAuthProvider;
        const code = searchParams.get("code");
        const redirectUri = `${window.location.origin}/profile/oauth/${provider}`;

        if (!code || !["google", "github", "linkedin"].includes(provider)) {
            router.replace("/profile");
            return;
        }

        api.post(`/me/oauth/${provider}`, { code, redirectUri })
            .then(() => router.replace("/profile"))
            .catch(() => router.replace("/profile"));
    }, [params.provider, router, searchParams]);

    return (
        <div className="flex min-h-screen items-center justify-center text-sm text-black/50">
            Liaison du compte...
        </div>
    );
}
