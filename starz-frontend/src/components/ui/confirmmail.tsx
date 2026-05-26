"use client"
import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { IoArrowBack } from "react-icons/io5"
import { MdOutlineMarkEmailRead } from "react-icons/md"
import { verifyEmail, resendVerification } from "@/features/auth/auth.api"

export default function Confirmmail() {
    const [code, setCode] = useState(["", "", "", "", "", ""])
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [resendCooldown, setResendCooldown] = useState(0)
    const [isResending, setIsResending] = useState(false)
    const [resendMessage, setResendMessage] = useState<string | null>(null)
    const inputs = useRef<(HTMLInputElement | null)[]>([])
    const router = useRouter()
    const searchParams = useSearchParams()
    const email = searchParams.get("email") ?? ""

    useEffect(() => {
        if (resendCooldown <= 0) return

        const timer = setTimeout(() => {
            setResendCooldown((value) => Math.max(0, value - 1))
        }, 1000)

        return () => clearTimeout(timer)
    }, [resendCooldown])

    const handleChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return
        const newCode = [...code]
        newCode[index] = value.slice(-1)
        setCode(newCode)
        if (value && index < 5) inputs.current[index + 1]?.focus()
    }

    const handlePaste = (e: React.ClipboardEvent) => {
        const pasted = e.clipboardData.getData("text").slice(0, 6).split("")
        const newCode = [...code]
        pasted.forEach((char, i) => { if (/\d/.test(char)) newCode[i] = char })
        setCode(newCode)
        inputs.current[Math.min(pasted.length, 5)]?.focus()
    }

    const handleSubmit = async () => {
        const fullCode = code.join("")
        if (fullCode.length < 6) {
            setError("Saisis les 6 chiffres du code.")
            return
        }
        setError(null)
        try {
            await verifyEmail(email, fullCode)
            setSuccess(true)
            setTimeout(() => router.push("/"), 1500)
        } catch {
            setError("Code invalide ou expiré.")
        }
    }

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            handleSubmit()
            return
        }

        if (e.key === "Backspace" && !code[index] && index > 0) {
            inputs.current[index - 1]?.focus()
        }
    }

    const handleResend = async () => {
        if (resendCooldown > 0 || isResending) return
        if (!email) {
            setResendMessage("Email manquant. Retourne sur l'inscription pour recréer un lien valide.")
            return
        }

        setResendMessage(null)
        setIsResending(true)

        try {
            const result = await resendVerification(email)
            setResendMessage(result?.code ? `Code renvoyé : ${result.code}` : "Code renvoyé si le délai de sécurité est écoulé.")
            setResendCooldown(120)
        } catch (error) {
            const message = error instanceof Error ? error.message : "Impossible de renvoyer le code."
            setResendMessage(message)
        } finally {
            setIsResending(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="bg-page rounded-3xl shadow-[0_8px_20px_rgba(111,45,189,0.12)] border border-thepurple/20 p-10 w-full max-w-8/10 sm:max-w-5/10 flex flex-col gap-6 ">
                <Link href="/" aria-label="Retour à l'accueil"><IoArrowBack className="h-7 w-7 hover:scale-110 transition-transform duration-150" /></Link>
                <div className="flex justify-center">
                    <div className="bg-thepurple/10 rounded-2xl p-5">
                        <MdOutlineMarkEmailRead className="h-12 w-12 text-thepurple" />
                    </div>
                </div>
                <div className="flex flex-col gap-2 text-center">
                    <h2 className="text-2xl font-black text-black tracking-tight">Vérifie ta boîte mail</h2>
                    <p className="text-sm text-black/40 leading-relaxed">
                        On t&apos;a envoyé un code à 6 chiffres{email ? ` à ${email}` : ""}.<br />Saisis-le ci-dessous pour confirmer ton compte.
                    </p>
                </div>
                <div className="flex justify-center gap-1.5 md:gap-3">
                    {code.map((digit, i) => (
                        <input
                            key={i}
                            ref={el => { inputs.current[i] = el }}
                            type="text"
                            name={`verification-code-${i}`}
                            autoComplete="one-time-code"
                            autoCorrect="off"
                            spellCheck={false}
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleChange(i, e.target.value)}
                            onKeyDown={e => handleKeyDown(i, e)}
                            onPaste={handlePaste}
                            className={`w-12 h-14 text-center text-xl font-black rounded-xl border-2 outline-none transition-all duration-200 bg-white text-black
                                ${digit ? "border-thepurple shadow-[0_0_0_3px_rgba(111,45,189,0.1)]" : "border-black/10"}
                                focus:border-thepurple focus:shadow-[0_0_0_3px_rgba(111,45,189,0.1)]`}
                        />
                    ))}
                </div>
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                {success && <p className="text-green-600 text-sm text-center font-semibold">Compte confirmé ! Redirection...</p>}
                <div className="w-full h-px bg-black/10" />
                <button
                    onClick={handleSubmit}
                    disabled={success}
                    className="w-8/10 mx-auto py-3 bg-thepurple text-white font-bold text-sm rounded-xl hover:bg-thepurple/90 hover:scale-[1.02] transition-all duration-150 shadow-[0_4px_14px_rgba(111,45,189,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                    Confirmer mon compte
                </button>
                <div className="flex flex-col gap-2 text-center">
                    <p className="text-sm text-black/40">{"Tu n'as rien reçu ?"}</p>
                    <button
                        onClick={handleResend}
                        disabled={resendCooldown > 0 || isResending}
                        className="text-sm text-thepurple/70 font-semibold hover:text-thepurple transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isResending ? "Envoi..." : resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : "Renvoyer le code"}
                    </button>
                    {resendMessage && <p className="text-xs text-black/40">{resendMessage}</p>}
                </div>
            </div>
        </div>
    )
}
