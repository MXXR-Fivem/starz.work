"use client"

import { useState } from "react"
import Link from "next/link"
import { Logo } from "../assets/logo"
import { IoArrowBack, IoEye, IoEyeOff } from "react-icons/io5";
import { forgotPassword, login, register, oauthGetUrl, type OAuthProvider, type RegisterPayload } from "@/features/auth/auth.api";
import { useRouter, useSearchParams } from "next/navigation";
import { parseFrenchDateInput } from "@/lib/date";

type ApiErrorResponse = {
    message?: string;
    errors?: { message?: string }[];
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error !== "object" || error === null || !("response" in error)) {
        return fallback;
    }

    const response = (error as { response?: { data?: ApiErrorResponse } }).response;
    const data = response?.data;
    const validationMessage = data?.errors?.find((item) => item.message)?.message;

    return validationMessage ?? data?.message ?? fallback;
};

export default function Regcard(){
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [resetLink, setResetLink] = useState<string | null>(null);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [isLogin, setIsLogin] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get("redirect") ?? "/";

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);
        setIsSubmitting(true);

        try {
            if (isForgotPassword) {
                const result = await forgotPassword(email);
                setSuccess("Si ce compte existe, un lien de réinitialisation vient d'être envoyé.");
                setResetLink(result.token ? `/auth/reset-password?token=${encodeURIComponent(result.token)}` : null);
                return;
            }

            if (!isLogin) {
                if (password !== confirmPassword) {
                    setError("Les mots de passe ne correspondent pas.");
                    return;
                }

                const payload: RegisterPayload = {
                    email,
                    password,
                    firstName,
                    lastName,
                    status: "en_recherche",
                };

                if (dateOfBirth) {
                    const parsedDateOfBirth = parseFrenchDateInput(dateOfBirth);

                    if (parsedDateOfBirth === null) {
                        setError("La date de naissance doit être au format jj/mm/aaaa.");
                        return;
                    }

                    payload.dateOfBirth = parsedDateOfBirth;
                }

                await register(payload);

                router.push(`/auth/confirmmail?email=${encodeURIComponent(email)}`);
                return;
            }

            await login({ email, password });
            router.push(redirectTo);
        } catch (error) {
            setError(
                getApiErrorMessage(
                    error,
                    isForgotPassword
                        ? "Impossible de demander la réinitialisation."
                        : isLogin ? "Email ou mot de passe invalide." : "Impossible de créer le compte."
                )
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOAuth = async (provider: OAuthProvider) => {
        setOauthLoading(provider);
        setError(null);
        try {
            const callbackUrl = `${window.location.origin}/auth/callback/${provider}`;
            sessionStorage.setItem("oauth_redirect", redirectTo);
            const state = JSON.stringify({
                provider,
                mode: "login",
                redirectTo,
            });
            const url = await oauthGetUrl(provider, callbackUrl, state);
            window.location.href = url;
        } catch {
            setError("Impossible de se connecter avec ce service.");
            setOauthLoading(null);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="bg-page rounded-3xl shadow-[0_8px_20px_rgba(111,45,189,0.12)] border border-thepurple/20 p-6 sm:p-10 w-full max-w-9/10 md:max-w-4/10 flex flex-col gap-6 mt-10 sm:mt-20 mb-10 sm:mb-20">
                {isForgotPassword ? (
                    <button
                        type="button"
                        onClick={() => {
                            setIsForgotPassword(false);
                            setError(null);
                            setSuccess(null);
                            setResetLink(null);
                        }}
                        aria-label="Retour à la connexion"
                        className="w-fit"
                    >
                        <IoArrowBack className="h-7 w-7 hover:scale-110" />
                    </button>
                ) : (
                    <Link href={"/"} aria-label="Retour à l'accueil"><IoArrowBack className="h-7 w-7 hover:scale-110" /></Link>
                )}
                <Logo className="h-13 w-full drop-shadow-[0px_3px_0.5px_rgba(0,0,0,0.3)]" />
                <div className="flex flex-col gap-1 text-center">
                    <h2 className="text-2xl font-black text-black tracking-tight">
                        {isForgotPassword ? "Réinitialise ton mot de passe" : isLogin ? "Bon retour " : "Crée ton compte "}
                    </h2>
                    <p className="text-s text-black/40">
                        {isForgotPassword ? "Entre ton email, on t'envoie la suite." : isLogin ? "Connecte-toi pour accéder à tes offres." : "Rejoins des milliers de candidats sur Starz."}
                    </p>
                </div> 
                {!isForgotPassword && <div className="flex rounded-xl bg-page p-1">
                    <button
                        type="button"
                        onClick={() => setIsLogin(true)}
                        className={`flex-1 py-2 rounded-lg text-m font-semibold transition-all duration-200 ${isLogin ? "bg-thepurple text-white shadow-sm" : "text-black/40 hover:text-black/60"}`}
                    >
                        Se connecter
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsLogin(false)}
                        className={`flex-1 py-2 rounded-lg text-m font-semibold transition-all duration-200 ${!isLogin ? "bg-thepurple text-white shadow-sm" : "text-black/40 hover:text-black/60"}`}
                    >
                        S&apos;inscrire
                    </button>
                </div>}
                <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-black/60">Email</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="jean.noriot@epitech.eu"
                            className="w-full px-4 py-3 rounded-xl border border-black/10 outline-none text-sm text-black placeholder:text-black/25 focus:border-thepurple/50 focus:ring-2 focus:ring-thepurple/10 transition-all duration-200"
                        />
                    </div>  
                    {!isLogin && !isForgotPassword && (
                        <div className="flex flex-col gap-1.5">
                            <div>  
                                <label className="text-sm font-semibold text-black/60">Nom</label>
                                <input
                                    type="text"
                                    required={!isLogin}
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Noriot"
                                    className="w-full px-4 py-3 rounded-xl border border-black/10 outline-none text-sm text-black placeholder:text-black/25 focus:border-thepurple/50 focus:ring-2 focus:ring-thepurple/10 transition-all duration-200"
                                />
                            </div>  
                            <div>
                                <label className="text-sm font-semibold text-black/60">Prénom</label>
                                <input
                                    type="text"
                                    required={!isLogin}
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="Jean"
                                    className="w-full px-4 py-3 rounded-xl border border-black/10 outline-none text-sm text-black placeholder:text-black/25 focus:border-thepurple/50 focus:ring-2 focus:ring-thepurple/10 transition-all duration-200"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-black/60">Date de naissance</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={dateOfBirth}
                                    onChange={(e) => setDateOfBirth(e.target.value)}
                                    placeholder="jj/mm/aaaa"
                                    className="w-full px-4 py-3 rounded-xl border border-black/10 outline-none text-sm text-black placeholder:text-black/25 focus:border-thepurple/50 focus:ring-2 focus:ring-thepurple/10 transition-all duration-200"
                                />
                            </div>
                        </div>
                    )}
                    {!isForgotPassword && <div>
                        <label className="text-sm font-semibold text-black/60">Mot de passe</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="•••••••••••"
                                className="w-full px-4 py-3 pr-12 rounded-xl border border-black/10 outline-none text-sm text-black placeholder:text-black/25 focus:border-thepurple/50 focus:ring-2 focus:ring-thepurple/10 transition-all duration-200"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((value) => !value)}
                                aria-label={showPassword ? "Cacher le mot de passe" : "Afficher le mot de passe"}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-thepurple transition-colors"
                            >
                                {showPassword ? <IoEyeOff className="h-5 w-5" /> : <IoEye className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>}
                    {!isLogin && !isForgotPassword && (
                        <div className="flex flex-col">
                            <label className="text-sm font-semibold text-black/60">Confirmer le mot de passe</label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    required={!isLogin}
                                    minLength={8}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="•••••••••••"
                                    className="w-full px-4 py-3 pr-12 rounded-xl border border-black/10 outline-none text-sm text-black placeholder:text-black/25 focus:border-thepurple/50 focus:ring-2 focus:ring-thepurple/10 transition-all duration-200"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword((value) => !value)}
                                    aria-label={showConfirmPassword ? "Cacher la confirmation du mot de passe" : "Afficher la confirmation du mot de passe"}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-thepurple transition-colors"
                                >
                                    {showConfirmPassword ? <IoEyeOff className="h-5 w-5" /> : <IoEye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>  
                    )}
                    {error && (
                        <p className="text-red-500 text-sm text-center">{error}</p>
                    )}
                    {success && (
                        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm text-emerald-700">
                            <p>{success}</p>
                            {resetLink && <Link href={resetLink} className="mt-1 inline-block font-semibold underline">Ouvrir le lien de test</Link>}
                        </div>
                    )}
                    {isLogin && !isForgotPassword && (
                        <button
                            type="button"
                            onClick={() => {
                                setIsForgotPassword(true);
                                setError(null);
                                setSuccess(null);
                            }}
                            className="self-start text-[15.4px] font-semibold text-thepurple hover:text-thepurple/75"
                        >
                            Mot de passe oublié ?
                        </button>
                    )}
                    {isForgotPassword && (
                        <button
                            type="button"
                            onClick={() => {
                                setIsForgotPassword(false);
                                setError(null);
                                setSuccess(null);
                                setResetLink(null);
                            }}
                            className="self-center text-sm font-semibold text-black/45 hover:text-thepurple"
                        >
                            Retour à la connexion
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitting || oauthLoading !== null}
                        className=" w-5/10 mx-auto py-3 bg-thepurple text-white font-bold text-m rounded-xl hover:bg-thepurple/90 hover:scale-[1.02] transition-all duration-150 shadow-[0_4px_14px_rgba(111,45,189,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 sm:mt-2"
                    >
                        {isSubmitting ? "..." : isForgotPassword ? "Envoyer le lien" : isLogin ? "Se connecter" : "Créer mon compte"}
                    </button>
                </form>
                {!isForgotPassword && <><div className="w-full h-px bg-black/10" />
                <div className="flex gap-3">
                    <button
                        type="button"
                        disabled={oauthLoading !== null}
                        onClick={() => handleOAuth("google")}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-black/10 rounded-xl text-sm font-semibold text-black/70 hover:border-thepurple/30 hover:scale-105 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        {oauthLoading === "google" ? "..." : "Google"}
                    </button>
                    <button
                        type="button"
                        disabled={oauthLoading !== null}
                        onClick={() => handleOAuth("linkedin")}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-black/10 rounded-xl text-sm font-semibold text-black/70 hover:border-thepurple/30 hover:scale-105 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                        {oauthLoading === "linkedin" ? "..." : "LinkedIn"}
                    </button>
                    <button
                        type="button"
                        disabled={oauthLoading !== null}
                        onClick={() => handleOAuth("github")}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-black/10 rounded-xl text-sm font-semibold text-black/70 hover:border-thepurple/30 hover:scale-105 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#181717">
                            <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                        </svg>
                        {oauthLoading === "github" ? "..." : "GitHub"}
                    </button>
                </div></>}
            </div>
        </div>
    )
}
