'use client'

import { Logo } from '../assets/logo'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { hasSessionCookie, SESSION_CHANGED_EVENT } from '@/lib/session'

export default function Navbar() {
    const [isLogged, setIsLogged] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)

    useEffect(() => {
        const refreshSession = () => setIsLogged(hasSessionCookie())
        refreshSession()
        window.addEventListener(SESSION_CHANGED_EVENT, refreshSession)
        window.addEventListener('storage', refreshSession)
        window.addEventListener('focus', refreshSession)
        return () => {
            window.removeEventListener(SESSION_CHANGED_EVENT, refreshSession)
            window.removeEventListener('storage', refreshSession)
            window.removeEventListener('focus', refreshSession)
        }
    }, [])

    return (
        <nav id="Navbar" className="top-0 left-0 right-0 z-50 px-4 sm:px-8 py-4 mt-3">
            <div className="hidden md:flex items-center justify-between">
                <ul className="flex justify-end items-center gap-12 w-1/2 pr-8">
                    <li>
                        <span className="relative group">
                            <Link href="/offers" className="text-black text-2xl font-medium opacity-75 hover:opacity-100 transition-opacity duration-200">Offres</Link>
                            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-thepurple group-hover:w-full transition-all duration-200" />
                        </span>
                    </li>
                    <li>
                        <span className="relative group">
                            <Link href="/hire" className="text-black text-2xl font-medium opacity-75 hover:opacity-100 transition-opacity duration-200">Recruter</Link>
                            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-thepurple group-hover:w-full transition-all duration-200" />
                        </span>
                    </li>
                </ul>
                <div className="w-1/3 flex justify-center">
                    <Link href="/" aria-label="Accueil Starz"><Logo className="h-12.25 w-55.25 drop-shadow-[0px_3px_0.5px_rgba(0,0,0,0.3)]" /></Link>
                </div>
                <ul className="flex items-center gap-12 w-1/2 justify-start pl-8">
                    <li>
                        <span className="relative group">
                            <Link href="/applications" className="text-black text-2xl font-medium opacity-75 hover:opacity-100 transition-opacity duration-200">Candidatures</Link>
                            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-thepurple group-hover:w-full transition-all duration-200" />
                        </span>
                    </li>
                    <li>
                        {!isLogged ? (
                            <Link href="/auth/login" className="inline-block px-5 py-2.5 bg-thepurple text-white text-m font-semibold rounded-xl hover:scale-105 transition-transform duration-150 drop-shadow-[0px_3px_0.5px_rgba(0,0,0,0.2)]">
                                Se connecter
                            </Link>
                        ) : (
                            <Link href="/profile">
                                <button className="flex items-center justify-center w-13 h-13 rounded-2xl bg-thepurple text-white font-semibold text-sm hover:scale-105 transition-transform duration-150 drop-shadow-[0px_3px_0.5px_rgba(0,0,0,0.2)] focus:outline-none" aria-label="Menu profil">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                                    </svg>
                                </button>
                            </Link>
                        )}
                    </li>
                </ul>
            </div>

            <div className="grid md:hidden grid-cols-3 items-center">
                <div />

                <div className="flex justify-center">
                    <Link href="/" onClick={() => setMenuOpen(false)} aria-label="Accueil Starz">
                        <Logo className="h-8 w-40 drop-shadow-[0px_3px_0.5px_rgba(0,0,0,0.3)]"/>
                    </Link>
                </div>

                <div className="flex items-center justify-end gap-2">
                    <Link href={isLogged ? "/profile" : "/auth/login"} aria-label="Profil">
                        <button className="flex items-center justify-center w-10 h-10 rounded-xl text-black/60 hover:bg-black/5 transition-colors" aria-label="Profil">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="8" r="4"/>
                                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                            </svg>
                        </button>
                    </Link>
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="flex flex-col justify-center items-center gap-1.5 w-10 h-10 rounded-xl hover:bg-black/5 transition-colors"
                        aria-label="Menu"
                    >
                        <span className={`block w-5 h-0.5 bg-black/70 dark:bg-white/70 transition-all duration-200 origin-center ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                        <span className={`block w-5 h-0.5 bg-black/70 dark:bg-white/70 transition-all duration-200 ${menuOpen ? 'opacity-0 scale-x-0' : ''}`} />
                        <span className={`block w-5 h-0.5 bg-black/70 dark:bg-white/70 transition-all duration-200 origin-center ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
                    </button>
                </div>
            </div>

            {menuOpen && (
                <div className="md:hidden mt-3 bg-white rounded-2xl border border-black/10 shadow-lg p-3 flex flex-col gap-1">
                    <Link href="/offers" onClick={() => setMenuOpen(false)} className="flex items-center px-4 py-3 rounded-xl text-black/70 font-medium text-base hover:bg-thepurple/10 hover:text-thepurple transition-colors">
                        Offres
                    </Link>
                    <Link href="/hire" onClick={() => setMenuOpen(false)} className="flex items-center px-4 py-3 rounded-xl text-black/70 font-medium text-base hover:bg-thepurple/10 hover:text-thepurple transition-colors">
                        Recruter
                    </Link>
                    <Link href="/applications" onClick={() => setMenuOpen(false)} className="flex items-center px-4 py-3 rounded-xl text-black/70 font-medium text-base hover:bg-thepurple/10 hover:text-thepurple transition-colors">
                        Candidatures
                    </Link>
                    {!isLogged && (
                        <Link href="/auth/login" onClick={() => setMenuOpen(false)} className="mt-1 px-4 py-3 bg-thepurple text-white font-semibold rounded-xl text-center text-base">
                            Se connecter
                        </Link>
                    )}
                </div>
            )}
        </nav>
    )
}
