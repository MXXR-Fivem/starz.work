"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiArrowRight, FiBriefcase, FiCheckCircle, FiMapPin, FiSearch, FiShield, FiTrendingUp, FiUsers } from "react-icons/fi";
import type { iOffers } from "@/components/schemas/offerapi";
import { decodeHtmlEntities } from "@/lib/html";
import { formatContractType } from "@/lib/offerLabels";
import { api } from "@/lib/axios";
import { hasSessionCookie, SESSION_CHANGED_EVENT } from "@/lib/session";

const steps = [
    { icon: FiSearch, title: "Cherche moins, cible mieux", text: "Filtres utiles, offres lisibles et recherche par lieu, contrat, salaire ou compétences." },
    { icon: FiCheckCircle, title: "Candidate avec un profil prêt", text: "CV, liens, skills et suivi de candidature restent au même endroit." },
    { icon: FiTrendingUp, title: "Suis ton avancée", text: "Retrouve les candidatures vues, acceptées, favorites et les prochaines actions." },
];

const audiences = [
    { icon: FiBriefcase, title: "Stages, alternances, premiers jobs", text: "Un flux pensé pour les étudiants et jeunes diplômés, sans bruit inutile." },
    { icon: FiUsers, title: "Entreprises et équipes", text: "Invitez vos collaborateurs, publiez vos offres et pilotez les candidatures." },
    { icon: FiShield, title: "Compte sous contrôle", text: "OAuth, sessions révocables, vérification email et gestion de profil sécurisée." },
];

export default function HomeFeatures() {
    const [isLogged, setIsLogged] = useState(false);
    const [offers, setOffers] = useState<iOffers[]>([]);

    useEffect(() => {
        const refreshSession = () => setIsLogged(hasSessionCookie());

        refreshSession();
        window.addEventListener(SESSION_CHANGED_EVENT, refreshSession);
        window.addEventListener("storage", refreshSession);
        window.addEventListener("focus", refreshSession);

        return () => {
            window.removeEventListener(SESSION_CHANGED_EVENT, refreshSession);
            window.removeEventListener("storage", refreshSession);
            window.removeEventListener("focus", refreshSession);
        };
    }, []);

    useEffect(() => {
        api.get("/offers/random")
            .then((response) => setOffers(response.data.data.offers ?? []))
            .catch(() => setOffers([]));
    }, []);

    return (
        <section className="mx-auto mt-10 sm:mt-16 flex w-full max-w-7xl flex-col gap-10 sm:gap-14 px-4 sm:px-8 pb-12 sm:pb-20">
            <div className="grid gap-4 md:grid-cols-3">
                {steps.map(({ icon: Icon, title, text }) => (
                    <article key={title} className="rounded-2xl border border-thepurple/10 bg-white p-5 shadow-ombre">
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-thepurple/10 text-thepurple">
                            <Icon className="h-5 w-5" />
                        </div>
                        <h2 className="text-lg font-black text-black/80">{title}</h2>
                        <p className="mt-2 text-sm leading-6 text-black/60">{text}</p>
                    </article>
                ))}
            </div>

            <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="flex flex-col gap-5">
                    <p className="w-fit rounded-full px-3 py-1 text-sm font-bold bg-thepurple/50 text-white">Pour des candidats ambitieux</p>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black leading-tight text-black/80">Une plateforme emploi qui garde le rythme des jeunes talents.</h2>
                    <p className="max-w-2xl text-base sm:text-lg leading-7 sm:leading-8 text-black/60">
                        Starz peut devenir l&apos;espace où l&apos;on découvre les bonnes opportunités, construit un profil crédible et suit chaque candidature sans tableur à côté.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Link href="/offers" className="inline-flex items-center gap-2 rounded-xl bg-thepurple px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(111,45,189,0.25)] transition-transform hover:scale-[1.02]">
                            Explorer les offres <FiArrowRight />
                        </Link>
                        {!isLogged && (
                            <Link href="/auth/login" className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-5 py-3 text-sm font-bold text-black/65 transition-colors hover:border-thepurple/30 hover:text-thepurple">
                                Créer mon profil
                            </Link>
                        )}
                    </div>
                </div>

                <div className="rounded-3xl border border-thepurple/10 bg-white p-5 shadow-ombre">
                    <div className="p-5">
                        <div className="mb-5 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-black/70">Offres recommandées</p>
                                <p className="text-xs text-black/60">Sélection fraîche pour démarrer</p>
                            </div>
                            <span className="rounded-full px-3 py-1 text-xs font-bold bg-thepurple/10 text-thepurple">Live</span>
                        </div>  
                        {offers.map((offer, index) => (
                            <Link href={`/offers/${offer.id}`} key={offer.id} className="mb-3 block rounded-xl border border-thepurple/10 bg-white p-4 shadow-ombre transition-shadow hover:shadow-md last:mb-0">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="font-bold text-black/75">{decodeHtmlEntities(offer.title)}</h3>
                                        {offer.location && <p className="mt-1 flex items-center gap-1 text-sm text-black/60"><FiMapPin className="h-3.5 w-3.5" />{offer.location}</p>}
                                    </div>
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${index === 1 ? "bg-thepurple/10 text-thepurple" : "bg-thepurple/10 text-thepurple"}`}>
                                        {formatContractType(offer.contractType) || "Offre"}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {audiences.map(({ icon: Icon, title, text }) => (
                    <article key={title} className="rounded-2xl border border-thepurple/10 bg-white p-5 shadow-ombre">
                        <Icon className="mb-4 h-6 w-6 text-thepurple" />
                        <h2 className="text-base font-black text-black/75">{title}</h2>
                        <p className="mt-2 text-sm leading-6 text-black/60">{text}</p>
                    </article>
                ))}
            </div>
        </section>
    );
}
