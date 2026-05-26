"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { IoArrowBack, IoEye, IoEyeOff } from "react-icons/io5";
import { resetPassword } from "@/features/auth/auth.api";
import { Logo } from "@/components/assets/logo";

function ResetPasswordForm() {
    const router = useRouter();
    const token = useSearchParams().get("token") ?? "";
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        if (!token) {
            setError("Lien de réinitialisation invalide.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Les mots de passe ne correspondent pas.");
            return;
        }

        setIsSubmitting(true);
        try {
            await resetPassword(token, password);
            router.push("/auth/login");
        } catch {
            setError("Impossible de réinitialiser le mot de passe.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center px-6">
            <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-5 rounded-3xl border border-thepurple/20 bg-page p-8 shadow-[0_8px_20px_rgba(111,45,189,0.12)]">
                <Link href="/auth/login" aria-label="Retour au login"><IoArrowBack className="h-7 w-7 hover:scale-110" /></Link>
                <Logo className="h-13 w-full drop-shadow-[0px_3px_0.5px_rgba(0,0,0,0.3)]" />
                <div className="text-center">
                    <h1 className="text-2xl font-black text-black">Nouveau mot de passe</h1>
                    <p className="text-sm text-black/40">Choisis un mot de passe d&apos;au moins 8 caractères.</p>
                </div>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-black/60">
                    Mot de passe
                    <span className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            required
                            minLength={8}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="w-full rounded-xl border border-black/10 px-4 py-3 pr-12 text-sm text-black outline-none transition-all duration-200 focus:border-thepurple/50 focus:ring-2 focus:ring-thepurple/10"
                        />
                        <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-thepurple" aria-label="Afficher ou cacher le mot de passe">
                            {showPassword ? <IoEyeOff className="h-5 w-5" /> : <IoEye className="h-5 w-5" />}
                        </button>
                    </span>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-black/60">
                    Confirmation
                    <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm text-black outline-none transition-all duration-200 focus:border-thepurple/50 focus:ring-2 focus:ring-thepurple/10"
                    />
                </label>
                {error && <p className="text-center text-sm text-red-500">{error}</p>}
                <button disabled={isSubmitting} className="mx-auto rounded-xl bg-thepurple px-6 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(111,45,189,0.3)] transition-all duration-150 hover:scale-[1.02] hover:bg-thepurple/90 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100">
                    {isSubmitting ? "..." : "Réinitialiser"}
                </button>
            </form>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen" />}>
            <ResetPasswordForm />
        </Suspense>
    );
}
