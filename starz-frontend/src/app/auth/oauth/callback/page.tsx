"use client";

import {Suspense, useEffect, useRef} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {oauthLogin, type OAuthProvider} from "@/features/auth/auth.api";

const VALID_PROVIDERS: OAuthProvider[] = ["google", "github", "linkedin"];

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const code = searchParams.get("code");
    const stateRaw = searchParams.get("state");
    const redirectUri = `${window.location.origin}/auth/oauth/callback`;

    let provider: OAuthProvider | null = null;

    try {
      const state = JSON.parse(stateRaw ?? "{}") as { provider?: string };
      if (VALID_PROVIDERS.includes(state.provider as OAuthProvider)) {
        provider = state.provider as OAuthProvider;
      }
    } catch {

    }

    if (!code || !provider) {
      router.replace("/auth/login");
      return;
    }

    const destination = sessionStorage.getItem("oauth_redirect") ?? "/";
    sessionStorage.removeItem("oauth_redirect");

    oauthLogin(provider, code, redirectUri)
      .then(() => router.replace(destination))
      .catch(() => router.replace("/auth/login?error=oauth"));
  }, [router, searchParams]);

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
