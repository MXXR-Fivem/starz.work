"use client";

import Link from "next/link";
import { FormEvent } from "react";
import { FiCheckCircle, FiChevronDown, FiChevronLeft, FiChevronRight, FiEye, FiHome, FiLogIn, FiLogOut, FiMenu, FiPlus, FiSearch, FiSend, FiTrash2, FiX, FiXCircle } from "react-icons/fi";
import { FaCrown } from "react-icons/fa";
import { Logo } from "@/components/assets/logo";
import { Logoforbg } from "@/components/assets/logo2";
import Navbar from "@/components/ui/navbar";
import { decodeHtmlEntities } from "@/lib/html";
import type {
    ActiveTab,
    Activity,
    Company,
    CompanyApplication,
    CompanyData,
    DetailedStat,
    HireNavItem,
    HireStat,
    Member,
    Offer,
    OfferDraft,
    Pagination,
} from "./types";

export const emptyOfferDraft: OfferDraft = {
    title: "",
    description: "",
    descriptionPreview: "",
    location: "",
    contractType: "CDI",
    remotePolicy: "",
    status: "draft",
    salaryMin: "",
    salaryMax: "",
    premium: false,
};

export const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
export const roleLabel = (role: "owner" | "member") => role === "owner" ? "Gérant" : "Employé";
export const statusLabel = (status: Offer["status"]) => status === "published" ? "En cours" : status === "closed" ? "Désactivée" : "Brouillon";
export const applicationStatusClass = (status: CompanyApplication["status"]) => {
    if (status === "accepted") return "bg-emerald-100 text-emerald-700";
    if (status === "rejected" || status === "withdrawn") return "bg-red-100 text-red-600";
    if (status === "viewed") return "bg-thepurple/10 text-thepurple";
    return "bg-black/5 text-black/55";
};
export const formatDate = (date: string) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
export const timeAgo = (date: string, ageSeconds?: number) => {
    const seconds = Math.max(0, ageSeconds ?? Math.floor((Date.now() - new Date(date).getTime()) / 1000));
    if (seconds < 60) return "A l'instant";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Il y a ${minutes}min`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `Il y a ${hours}h` : `Il y a ${Math.floor(hours / 24)}j`;
};
export const mergeUniqueOffers = (previousOffers: Offer[], nextOffers: Offer[]): Offer[] => {
    const offersById = new Map<number, Offer>();

    for (const offer of [...previousOffers, ...nextOffers]) {
        offersById.set(offer.id, offer);
    }

    return Array.from(offersById.values());
};

export function HireLoading() {
    return <main className="flex min-h-screen items-center justify-center text-black/60">Chargement...</main>;
}

export function HireLanding({
    isGuest,
    companyName,
    onCompanyNameChange,
    onCreateCompany,
}: {
    isGuest: boolean;
    companyName: string;
    onCompanyNameChange: (value: string) => void;
    onCreateCompany: (event: FormEvent) => void;
}) {
    return (
        <main className="relative min-h-screen overflow-hidden text-black">
            <Navbar />
            <section className="mx-auto grid min-h-[82vh] max-w-7xl items-center gap-10 px-8 py-12 lg:grid-cols-[0.92fr_1.08fr]">
                <div className="flex flex-col items-start gap-6">
                    <p className="rounded-full bg-thepurple/10 px-4 py-1.5 text-sm font-bold text-thepurple">Espace recruteur Starz.Work</p>
                    <h1 className="max-w-2xl text-5xl font-black leading-tight text-black/85">Publiez, suivez et recrutez sans perdre le fil.</h1>
                    <p className="max-w-xl text-lg leading-8 text-black/50">Une démo concrète de votre futur tableau de bord : offres, membres, candidatures et activité restent synchronisés dans une interface simple pour votre équipe.</p>
                    <div className="grid w-full max-w-xl gap-3 sm:grid-cols-3">
                        {["Créer une offre", "Inviter l'équipe", "Suivre les candidats"].map((item) => (
                            <div key={item} className="rounded-2xl border border-thepurple/10 bg-white p-4 text-sm font-bold text-black/65 shadow-ombre transition-transform duration-150 hover:scale-[1.015]">{item}</div>
                        ))}
                    </div>
                    {isGuest ? (
                        <Link href="/auth/login?redirect=/hire" className="inline-flex items-center gap-2 rounded-xl bg-thepurple px-5 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(111,45,189,0.3)] transition-all hover:scale-[1.02] hover:bg-thepurple/90"><FiLogIn />Se connecter pour recruter</Link>
                    ) : (
                        <form onSubmit={onCreateCompany} className="flex w-full max-w-xl gap-3 rounded-2xl border border-thepurple/10 bg-white p-3 shadow-ombre transition-transform duration-150 hover:scale-[1.01]">
                            <input value={companyName} onChange={(event) => onCompanyNameChange(event.target.value)} required placeholder="Nom de votre entreprise" className="min-w-0 flex-1 rounded-xl border border-black/10 px-4 py-3 text-sm text-black outline-none placeholder:text-black/30 focus:border-thepurple/50" />
                            <button className="rounded-xl bg-thepurple px-5 py-3 text-sm font-bold text-white hover:bg-thepurple/90">Créer</button>
                        </form>
                    )}
                </div>

                <div className="rounded-3xl border border-thepurple/10 bg-white p-5 shadow-[0_16px_45px_rgba(111,45,189,0.16)] transition-transform duration-150 hover:scale-[1.01]">
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <p className="text-lg font-black text-black/80">Démo dashboard</p>
                            <p className="text-sm text-black/40">Vue recruteur instantanée</p>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Live</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {[["12", "Membres"], ["8", "Offres"], ["42", "Candidatures"]].map(([value, label]) => (
                            <div key={label} className="rounded-2xl border border-thepurple/10 bg-page p-4"><p className="text-2xl font-black text-black/80">{value}</p><p className="text-sm text-black/45">{label}</p></div>
                        ))}
                    </div>
                    <div className="mt-5 rounded-2xl border border-thepurple/10 p-4">
                        {["Développeur Full Stack Java", "Senior Back-End Developer", "Product Designer"].map((title, index) => (
                            <div key={title} className="flex items-center justify-between border-t border-black/10 py-3 first:border-t-0">
                                <div><p className="font-bold text-black/75">{title}</p><p className="text-sm text-black/40">{index + 4} candidatures</p></div>
                                <span className="rounded-full bg-thepurple/10 px-3 py-1 text-xs font-bold text-thepurple">En cours</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    );
}

function HireSidebar({ company, navItems, activeTab, onTabChange, sidebarOpen, onSidebarToggle }: { company: Company; navItems: HireNavItem[]; activeTab: ActiveTab; onTabChange: (tab: ActiveTab) => void; sidebarOpen: boolean; onSidebarToggle: () => void }) {
    return (
        <>
            <aside className="hidden lg:flex sticky top-0 flex-col h-screen border-r border-thepurple/10 bg-white/80 px-6 py-8 shadow-[8px_0_30px_rgba(111,45,189,0.07)] w-[300px]">
                <Link href="/" aria-label="Accueil Starz" className="mb-12 flex h-14 w-full items-center justify-center px-3">
                    <Logo className="h-12 w-52 overflow-visible drop-shadow-[0px_3px_0.5px_rgba(0,0,0,0.18)]" />
                </Link>
                <nav className="flex flex-col gap-2 text-sm font-semibold text-black/55">
                    {navItems.map((item) => (
                        <button key={item.key} type="button" onClick={() => onTabChange(item.key)} className={`rounded-xl px-4 py-3 text-left transition-colors ${activeTab === item.key ? "bg-thepurple text-white shadow-[0_8px_24px_rgba(111,45,189,0.22)]" : "hover:bg-thepurple/10 hover:text-thepurple"}`}>
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="mt-auto rounded-2xl border border-thepurple/10 bg-page p-4">
                    <p className="text-sm font-bold text-black/75">{company.name}</p>
                    <p className="mt-1 text-xs text-black/40">{roleLabel(company.role)}</p>
                </div>
                <Link href="/" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-thepurple/15 bg-white px-4 py-3 text-sm font-semibold text-black/55 hover:border-thepurple/40 hover:text-thepurple"><FiHome />Retour home</Link>
            </aside>
            {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onSidebarToggle} />}
            <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] lg:hidden flex flex-col border-r border-thepurple/10 bg-white px-6 py-8 shadow-[8px_0_30px_rgba(111,45,189,0.07)] transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <Link href="/" aria-label="Accueil Starz" className="mb-12 flex h-14 w-full items-center justify-center px-3">
                    <Logo className="h-12 w-52 overflow-visible drop-shadow-[0px_3px_0.5px_rgba(0,0,0,0.18)]" />
                </Link>
                <nav className="flex flex-col gap-2 text-sm font-semibold text-black/55">
                    {navItems.map((item) => (
                        <button key={item.key} type="button" onClick={() => { onTabChange(item.key); onSidebarToggle(); }} className={`rounded-xl px-4 py-3 text-left transition-colors ${activeTab === item.key ? "bg-thepurple text-white shadow-[0_8px_24px_rgba(111,45,189,0.22)]" : "hover:bg-thepurple/10 hover:text-thepurple"}`}>
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="mt-auto rounded-2xl border border-thepurple/10 bg-page p-4">
                    <p className="text-sm font-bold text-black/75">{company.name}</p>
                    <p className="mt-1 text-xs text-black/40">{roleLabel(company.role)}</p>
                </div>
                <Link href="/" onClick={onSidebarToggle} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-thepurple/15 bg-white px-4 py-3 text-sm font-semibold text-black/55 hover:border-thepurple/40 hover:text-thepurple"><FiHome />Retour home</Link>
            </aside>
        </>
    );
}

function HireHeader({
    company,
    activeTab,
    navItems,
    isOwner,
    sidebarOpen,
    companyMenuOpen,
    leavingCompany,
    leaveCompanyError,
    onCreateClick,
    onSidebarToggle,
    onMenuToggle,
    onLeaveCompany,
}: {
    company: Company;
    activeTab: ActiveTab;
    navItems: HireNavItem[];
    isOwner: boolean;
    sidebarOpen: boolean;
    companyMenuOpen: boolean;
    leavingCompany: boolean;
    leaveCompanyError: string | null;
    onCreateClick: () => void;
    onSidebarToggle: () => void;
    onMenuToggle: () => void;
    onLeaveCompany: () => void;
}) {
    return (
        <header className="mb-9 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <button onClick={onSidebarToggle} className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl text-black/60 hover:bg-black/5 transition-colors" aria-label="Menu">
                    {sidebarOpen ? <FiX className="h-6 w-6" /> : <FiMenu className="h-6 w-6" />}
                </button>
                <div>
                    <h1 className="text-3xl font-black text-black/85">{navItems.find((item) => item.key === activeTab)?.label}</h1>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {isOwner && activeTab !== "create" && <button type="button" onClick={onCreateClick} className="inline-flex items-center gap-2 rounded-xl bg-thepurple px-4 py-2 text-sm font-bold text-white shadow-[0_8px_22px_rgba(111,45,189,0.35)] transition-all hover:scale-[1.02] hover:bg-thepurple/90"><FiPlus />Créer une offre</button>}
                <div className="relative">
                    <button
                        type="button"
                        onClick={onMenuToggle}
                        className="inline-flex items-center gap-3 rounded-full border border-thepurple/20 bg-white py-1.5 pl-1.5 pr-4 text-sm font-bold text-black/70 shadow-[0_8px_24px_rgba(111,45,189,0.14)] transition-colors hover:border-thepurple/40 hover:text-thepurple"
                        aria-expanded={companyMenuOpen}
                        aria-haspopup="menu"
                    >
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-thepurple text-sm font-bold text-white">{initials(company.name)}</span>
                        <span className="max-w-40 truncate">{company.name}</span>
                        <FiChevronDown className={`h-4 w-4 transition-transform ${companyMenuOpen ? "rotate-180" : ""}`} />
                    </button>
                    {companyMenuOpen && (
                        <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-thepurple/20 bg-white p-2 text-sm shadow-[0_18px_50px_rgba(111,45,189,0.2)]" role="menu">
                            <div className="border-b border-black/10 px-3 py-2">
                                <p className="truncate font-black text-black/80">{company.name}</p>
                                <p className="mt-0.5 text-xs font-semibold text-black/40">{roleLabel(company.role)}</p>
                            </div>
                            <button
                                type="button"
                                onClick={onLeaveCompany}
                                disabled={leavingCompany}
                                className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left font-bold text-red-500 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                                role="menuitem"
                            >
                                <FiLogOut />
                                {leavingCompany ? "Départ..." : "Quitter l'entreprise"}
                            </button>
                            {leaveCompanyError && <p className="px-3 pb-2 pt-1 text-xs font-semibold leading-5 text-red-400">{leaveCompanyError}</p>}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

function StatCards({ stats }: { stats: HireStat[] }) {
    return (
        <div className="mb-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {stats.map(({ label, value, hint, icon: Icon }) => (
                <article key={label} className="rounded-2xl border border-thepurple/10 bg-white p-6 shadow-ombre">
                    <div className="mb-5 flex items-center justify-between text-black/55"><span>{label}</span><Icon className="text-thepurple" /></div>
                    <p className="text-4xl font-black text-black/85">{value}</p>
                    <p className="mt-3 text-sm font-semibold text-emerald-600">{hint}</p>
                </article>
            ))}
        </div>
    );
}

function StatsPanel({ data, detailedStats }: { data: CompanyData | null; detailedStats: DetailedStat[] }) {
    return (
        <div className="grid gap-7 xl:grid-cols-[1fr_1fr]">
            <article className="rounded-2xl border border-thepurple/10 bg-white p-6 shadow-ombre">
                <h2 className="mb-5 text-xl font-bold text-black/80">Indicateurs détaillés</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    {detailedStats.map((item) => (
                        <div key={item.label} className="rounded-xl border border-thepurple/10 bg-page p-4">
                            <p className="text-sm text-black/45">{item.label}</p>
                            <p className="mt-1 text-2xl font-black text-black/80">{item.value}</p>
                        </div>
                    ))}
                </div>
            </article>

            <article className="rounded-2xl border border-thepurple/10 bg-white p-6 shadow-ombre">
                <h2 className="mb-5 text-xl font-bold text-black/80">Premium vs standard</h2>
                {(data?.premiumPerformance ?? []).map((segment) => (
                    <div key={segment.type} className="border-t border-black/10 py-4 first:border-t-0">
                        <div className="flex items-center justify-between">
                            <p className="font-bold text-black/75">{segment.type === "premium" ? "Premium" : "Standard"}</p>
                            <span className="rounded-full bg-thepurple/10 px-3 py-1 text-xs font-bold text-thepurple">{segment.acceptanceRate}% acceptation</span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
                            <div><p className="font-black text-black/80">{segment.offersCount}</p><p className="text-black/40">Offres</p></div>
                            <div><p className="font-black text-black/80">{segment.applicationsCount}</p><p className="text-black/40">Candidatures</p></div>
                            <div><p className="font-black text-black/80">{segment.acceptedApplicationsCount}</p><p className="text-black/40">Acceptées</p></div>
                        </div>
                    </div>
                ))}
                {(data?.premiumPerformance?.length ?? 0) === 0 && <p className="text-sm text-black/40">Aucune donnée premium disponible.</p>}
            </article>

            <article className="rounded-2xl border border-thepurple/10 bg-white p-6 shadow-ombre xl:col-span-2">
                <h2 className="mb-5 text-xl font-bold text-black/80">Performance des offres</h2>
                {(data?.offerPerformance ?? []).map((offer) => (
                    <div key={offer.offerId} className="grid gap-4 border-t border-black/10 py-4 first:border-t-0 lg:grid-cols-[1fr_repeat(5,auto)] lg:items-center">
                        <div>
                            <p className="font-bold text-black/75">{decodeHtmlEntities(offer.title)}</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                                <span className="rounded-full bg-thepurple/10 px-2.5 py-1 text-xs font-bold text-thepurple">{statusLabel(offer.status)}</span>
                                {offer.premium && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">Premium</span>}
                            </div>
                        </div>
                        <div className="text-sm"><p className="font-black text-black/80">{offer.applicationsCount}</p><p className="text-black/40">Candidatures</p></div>
                        <div className="text-sm"><p className="font-black text-black/80">{offer.reviewedApplicationsCount}</p><p className="text-black/40">Vues</p></div>
                        <div className="text-sm"><p className="font-black text-emerald-600">{offer.acceptedApplicationsCount}</p><p className="text-black/40">Acceptées</p></div>
                        <div className="text-sm"><p className="font-black text-red-400">{offer.rejectedApplicationsCount}</p><p className="text-black/40">Rejetées</p></div>
                        <div className="text-sm"><p className="font-black text-thepurple">{offer.acceptanceRate}%</p><p className="text-black/40">Acceptation</p></div>
                    </div>
                ))}
                {(data?.offerPerformance?.length ?? 0) === 0 && <p className="text-sm text-black/40">Aucune performance disponible.</p>}
            </article>
        </div>
    );
}

function OffersPanel({
    activeTab,
    company,
    data,
    offers,
    offersLoading,
    offersError,
    offersPagination,
    offersSearch,
    selectedOfferId,
    offerApplications,
    applicationsLoading,
    applicationsError,
    selectedApplication,
    applicationDetailLoading,
    updatingApplicationId,
    onShowAll,
    onOffersSearchChange,
    onOffersPageChange,
    onSelectOffer,
    onOpenApplication,
    onOpenApplicationResume,
    onUpdateApplicationStatus,
}: {
    activeTab: ActiveTab;
    company: Company;
    data: CompanyData | null;
    offers: Offer[];
    offersLoading: boolean;
    offersError: string | null;
    offersPagination: Pagination;
    offersSearch: string;
    selectedOfferId: number | null;
    offerApplications: CompanyApplication[];
    applicationsLoading: boolean;
    applicationsError: string | null;
    selectedApplication: CompanyApplication | null;
    applicationDetailLoading: boolean;
    updatingApplicationId: number | null;
    onShowAll: () => void;
    onOffersSearchChange: (value: string) => void;
    onOffersPageChange: (page: number) => void;
    onSelectOffer: (offerId: number) => void;
    onOpenApplication: (application: CompanyApplication) => void;
    onOpenApplicationResume: (application: CompanyApplication) => void;
    onUpdateApplicationStatus: (application: CompanyApplication, status: "accepted" | "rejected") => void;
}) {
    const selectedOffer = offers.find((offer) => offer.id === selectedOfferId) ?? null;
    const canGoPrevious = offersPagination.page > 0;
    const canGoNext = offersPagination.page + 1 < offersPagination.totalPages;

    return (
        <article className="rounded-2xl border border-thepurple/10 bg-white p-6 shadow-ombre">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-black/80">{activeTab === "offers" ? "Offres" : "Offres récentes"}</h2>
                {activeTab === "overview" && <button type="button" onClick={onShowAll} className="text-sm font-bold text-thepurple hover:text-thepurple/75">Voir toutes</button>}
            </div>

            {activeTab === "offers" && (
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="relative block min-w-0 flex-1">
                        <span className="sr-only">Rechercher une offre</span>
                        <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
                        <input
                            value={offersSearch}
                            onChange={(event) => onOffersSearchChange(event.target.value)}
                            placeholder="Rechercher une offre"
                            className="w-full rounded-xl border border-black/10 py-3 pl-10 pr-4 text-sm outline-none placeholder:text-black/30 focus:border-thepurple/50"
                        />
                    </label>
                    <div className="flex items-center justify-end gap-2 text-sm font-bold text-black/55">
                        <button type="button" onClick={() => onOffersPageChange(offersPagination.page - 1)} disabled={!canGoPrevious || offersLoading} className="rounded-xl border border-thepurple/15 p-3 text-thepurple transition-colors hover:bg-thepurple/10 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Page précédente"><FiChevronLeft /></button>
                        <span className="min-w-24 text-center">Page {offersPagination.totalPages === 0 ? 0 : offersPagination.page + 1}/{offersPagination.totalPages}</span>
                        <button type="button" onClick={() => onOffersPageChange(offersPagination.page + 1)} disabled={!canGoNext || offersLoading} className="rounded-xl border border-thepurple/15 p-3 text-thepurple transition-colors hover:bg-thepurple/10 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Page suivante"><FiChevronRight /></button>
                    </div>
                </div>
            )}

            <div className={activeTab === "offers" ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]" : ""}>
                <div>
                    {offers.map((offer) => {
                        const performance = data?.offerPerformance.find((item) => item.offerId === offer.id);
                        const isSelected = activeTab === "offers" && offer.id === selectedOfferId;

                        return (
                            <button key={offer.id} type="button" onClick={() => activeTab === "offers" && onSelectOffer(offer.id)} className={`block w-full border-t border-black/10 py-4 text-left first:border-t-0 ${isSelected ? "rounded-xl border border-thepurple/30 bg-thepurple/5 px-4 first:border-t" : ""}`}>
                                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                                    <div><h3 className="font-bold text-black/75">{decodeHtmlEntities(offer.title)}</h3><p className="mt-1 text-sm text-black/40">{offer.location || company.name}</p></div>
                                    <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
                                        <span className="rounded-lg bg-thepurple/10 px-3 py-1 text-xs font-bold text-thepurple">{statusLabel(offer.status)}</span>
                                        {offer.premium && <span className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">Premium</span>}
                                    </div>
                                </div>
                                <div className="mt-3 grid gap-3 rounded-xl bg-page p-3 text-center text-sm sm:grid-cols-3">
                                    <div><p className="font-black text-black/80">{offer.applicationsCount}</p><p className="text-black/40">Candidatures</p></div>
                                    <div><p className="font-black text-black/80">{offer.viewsCount ?? 0}</p><p className="text-black/40">Vues offre</p></div>
                                    <div><p className="font-black text-thepurple">{performance?.acceptanceRate ?? 0}%</p><p className="text-black/40">Acceptation</p></div>
                                </div>
                                {activeTab === "offers" && performance && (
                                    <div className="mt-3 grid gap-3 rounded-xl bg-page p-3 text-center text-sm sm:grid-cols-3">
                                        <div><p className="font-black text-thepurple">{performance.reviewedApplicationsCount}</p><p className="text-black/40">En examen</p></div>
                                        <div><p className="font-black text-emerald-600">{performance.acceptedApplicationsCount}</p><p className="text-black/40">Acceptées</p></div>
                                        <div><p className="font-black text-red-400">{performance.rejectedApplicationsCount}</p><p className="text-black/40">Rejetées</p></div>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                    {activeTab === "offers" && offersLoading && <p className="border-t border-black/10 py-5 text-center text-sm text-black/40">Chargement...</p>}
                    {activeTab === "offers" && offersError && <p className="border-t border-black/10 py-5 text-center text-sm text-red-400">{offersError}</p>}
                    {offers.length === 0 && !offersLoading && <p className="border-t border-black/10 py-5 text-sm text-black/40">{activeTab === "offers" ? "Aucune offre." : "Aucune offre récente."}</p>}
                </div>

                {activeTab === "offers" && (
                    <div className="rounded-2xl border border-thepurple/10 bg-page p-4">
                        <h3 className="text-lg font-black text-black/80">{selectedOffer ? `Candidatures - ${decodeHtmlEntities(selectedOffer.title)}` : "Candidatures"}</h3>
                        {applicationsError && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-500">{applicationsError}</p>}
                        {applicationsLoading && <p className="mt-4 text-sm text-black/40">Chargement des candidatures...</p>}
                        {!applicationsLoading && offerApplications.length === 0 && <p className="mt-4 text-sm text-black/40">Aucune candidature pour cette offre.</p>}
                        <div className="mt-4 grid gap-3">
                            {offerApplications.map((application) => {
                                const isSelectedApplication = selectedApplication?.id === application.id;
                                const displayedApplication = isSelectedApplication ? selectedApplication : application;

                                return (
                                    <div key={application.id} className={`rounded-xl border p-3 transition-colors ${isSelectedApplication ? "border-thepurple/35 bg-thepurple/5" : "border-black/10 bg-page hover:border-thepurple/25"}`}>
                                        <button type="button" onClick={() => onOpenApplication(application)} className="w-full text-left">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate font-black text-black/75">{displayedApplication.applicant.firstName} {displayedApplication.applicant.lastName}</p>
                                                    <p className="mt-1 truncate text-sm text-black/40">{displayedApplication.applicant.email ?? "Email non renseigné"}</p>
                                                </div>
                                                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${applicationStatusClass(displayedApplication.status)}`}>
                                                    {applicationDetailLoading && isSelectedApplication ? "Ouverture..." : displayedApplication.statusLabel}
                                                </span>
                                            </div>
                                            <p className="mt-2 text-xs font-semibold text-black/35">Reçue le {formatDate(displayedApplication.appliedAt)}</p>
                                        </button>

                                        {isSelectedApplication && (
                                            <div className="mt-4 border-t border-black/10 pt-4">
                                                <div className="rounded-xl bg-white p-3 text-sm leading-6 text-black/55">
                                                    {displayedApplication.coverLetter || "Aucune lettre de motivation."}
                                                </div>
                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    {displayedApplication.resumeUrl ? (
                                                        <button type="button" onClick={() => onOpenApplicationResume(displayedApplication)} className="inline-flex items-center gap-2 rounded-xl border border-thepurple/20 px-3 py-2 text-sm font-bold text-thepurple hover:bg-thepurple/10"><FiEye />Ouvrir le CV</button>
                                                    ) : (
                                                        <span className="inline-flex items-center rounded-xl border border-black/10 px-3 py-2 text-sm font-bold text-black/35">Aucun CV</span>
                                                    )}
                                                    <button type="button" onClick={() => onUpdateApplicationStatus(displayedApplication, "accepted")} disabled={updatingApplicationId === displayedApplication.id || displayedApplication.status === "accepted"} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><FiCheckCircle />Accepter</button>
                                                    <button type="button" onClick={() => onUpdateApplicationStatus(displayedApplication, "rejected")} disabled={updatingApplicationId === displayedApplication.id || displayedApplication.status === "rejected"} className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"><FiXCircle />Refuser</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </article>
    );
}

function MembersPanel({
    members,
    isOwner,
    inviteEmail,
    onInviteEmailChange,
    onInviteMember,
    onKickMember,
}: {
    members: Member[];
    isOwner: boolean;
    inviteEmail: string;
    onInviteEmailChange: (value: string) => void;
    onInviteMember: (event: FormEvent) => void;
    onKickMember: (member: Member) => void;
}) {
    return (
        <article className="rounded-2xl border border-thepurple/10 bg-white p-6 shadow-ombre">
            <h2 className="mb-5 text-xl font-bold text-black/80">Membres de l&apos;équipe</h2>
            {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 border-t border-black/10 py-3 first:border-t-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-thepurple/10 text-sm font-bold text-thepurple">{initials(`${member.firstName} ${member.lastName}`)}</div>
                    <div className="min-w-0 flex-1"><p className="truncate font-bold text-black/75">{member.firstName} {member.lastName}</p><p className="text-sm text-black/40">{roleLabel(member.companyRole)}</p></div>
                    {isOwner && member.companyRole !== "owner" && <button onClick={() => onKickMember(member)} className="rounded-lg p-2 text-red-300 hover:bg-red-500/10" aria-label="Retirer le membre"><FiTrash2 /></button>}
                </div>
            ))}
            {isOwner && <form onSubmit={onInviteMember} className="mt-4 flex gap-2">
                <input value={inviteEmail} onChange={(event) => onInviteEmailChange(event.target.value)} type="email" required placeholder="email@exemple.com" className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none placeholder:text-black/30 focus:border-thepurple/50" />
                <button className="rounded-xl border border-thepurple/30 px-3 text-thepurple hover:bg-thepurple/10" aria-label="Inviter"><FiSend /></button>
            </form>}
        </article>
    );
}

function ActivityPanel({ activeTab, activity }: { activeTab: ActiveTab; activity: Activity[] }) {
    return (
        <article className={`${activeTab === "overview" ? "mt-7" : ""} rounded-2xl border border-thepurple/10 bg-white p-6 shadow-ombre`}>
            <h2 className="mb-5 text-xl font-bold text-black/80">Activité récente</h2>
            {activity.map((item) => (
                <div key={`${item.type}-${item.createdAt}-${item.title}`} className="flex items-center gap-3 py-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-thepurple/10 text-xs font-bold text-thepurple">{item.type === "application" ? "C" : "O"}</span>
                    <p className="flex-1 text-sm text-black/55"><strong className="text-black/75">{item.description}</strong> pour <span className="text-thepurple">{item.title}</span></p>
                    <span className="text-sm text-black/35">{timeAgo(item.createdAt, item.ageSeconds)}</span>
                </div>
            ))}
            {activity.length === 0 && <p className="text-sm text-black/40">Aucune activité récente.</p>}
        </article>
    );
}

function CreateOfferForm({
    offerDraft,
    onDraftChange,
    onSubmit,
}: {
    offerDraft: OfferDraft;
    onDraftChange: (draft: OfferDraft) => void;
    onSubmit: (event: FormEvent) => void;
}) {
    const updateDraft = (values: Partial<OfferDraft>) => onDraftChange({ ...offerDraft, ...values });

    return (
        <form onSubmit={onSubmit} className="grid gap-5 rounded-2xl border border-thepurple/10 bg-white p-6 shadow-ombre lg:grid-cols-2">
            <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-black/60">Titre</label>
                <input value={offerDraft.title} onChange={(event) => updateDraft({ title: event.target.value })} required placeholder="Développeur Full Stack" className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none placeholder:text-black/30 focus:border-thepurple/50" />
            </div>
            <div>
                <label className="mb-1 block text-sm font-semibold text-black/60">Lieu</label>
                <input value={offerDraft.location} onChange={(event) => updateDraft({ location: event.target.value })} placeholder="Paris, Remote..." className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none placeholder:text-black/30 focus:border-thepurple/50" />
            </div>
            <div>
                <label className="mb-1 block text-sm font-semibold text-black/60">Contrat</label>
                <select value={offerDraft.contractType} onChange={(event) => updateDraft({ contractType: event.target.value })} className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-thepurple/50">
                    <option>CDI</option>
                    <option>CDD</option>
                    <option>Stage</option>
                    <option>Alternance</option>
                    <option>Freelance</option>
                </select>
            </div>
            <div>
                <label className="mb-1 block text-sm font-semibold text-black/60">Télétravail</label>
                <select value={offerDraft.remotePolicy} onChange={(event) => updateDraft({ remotePolicy: event.target.value })} className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-thepurple/50">
                    <option value="">Non précisé</option>
                    <option>Sur site</option>
                    <option>Hybride</option>
                    <option>Remote</option>
                </select>
            </div>
            <div>
                <label className="mb-1 block text-sm font-semibold text-black/60">Statut</label>
                <select value={offerDraft.status} onChange={(event) => updateDraft({ status: event.target.value as Offer["status"] })} className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-thepurple/50">
                    <option value="draft">Brouillon</option>
                    <option value="published">Publier</option>
                </select>
            </div>
            <div>
                <label className="mb-1 block text-sm font-semibold text-black/60">Salaire min (k€)</label>
                <input type="number" min="0" value={offerDraft.salaryMin} onChange={(event) => updateDraft({ salaryMin: event.target.value })} placeholder="35" className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none placeholder:text-black/30 focus:border-thepurple/50" />
            </div>
            <div>
                <label className="mb-1 block text-sm font-semibold text-black/60">Salaire max (k€)</label>
                <input type="number" min="0" value={offerDraft.salaryMax} onChange={(event) => updateDraft({ salaryMax: event.target.value })} placeholder="45" className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none placeholder:text-black/30 focus:border-thepurple/50" />
            </div>
            <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-black/60">Résumé</label>
                <input value={offerDraft.descriptionPreview} onChange={(event) => updateDraft({ descriptionPreview: event.target.value })} placeholder="Une phrase courte visible dans les listes" className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none placeholder:text-black/30 focus:border-thepurple/50" />
            </div>
            <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-black/60">Description</label>
                <textarea value={offerDraft.description} onChange={(event) => updateDraft({ description: event.target.value })} required rows={7} placeholder="Missions, profil attendu, stack, rythme..." className="w-full resize-none rounded-xl border border-black/10 px-4 py-3 text-sm outline-none placeholder:text-black/30 focus:border-thepurple/50" />
            </div>
            <label className="relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border border-thepurple/10 bg-page p-5 transition-all hover:border-thepurple/30 lg:col-span-2">
                <div className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-white text-thepurple shadow-ombre">
                    <Logoforbg className="h-9 w-9 opacity-90" />
                    <FaCrown className="absolute -right-1 -top-1 h-4 w-4 text-thepurple" />
                </div>
                <input type="checkbox" checked={offerDraft.premium} onChange={(event) => updateDraft({ premium: event.target.checked })} className="h-5 w-5 accent-thepurple" />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-black/80">Mettre cette offre en premium</p>
                        <span className="rounded-full bg-thepurple px-3 py-1 text-xs font-bold text-white">5,99 € / offre</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-black/50">
                        Le premium met votre offre en avant parmi les premières opportunités visibles pour attirer plus vite les bons candidats.
                    </p>
                </div>
            </label>
            <div className="flex justify-end lg:col-span-2">
                <button className="inline-flex items-center gap-2 rounded-xl bg-thepurple px-5 py-3 text-sm font-bold text-white shadow-[0_8px_22px_rgba(111,45,189,0.35)] transition-all hover:scale-[1.02] hover:bg-thepurple/90"><FiPlus />Créer l&apos;offre</button>
            </div>
        </form>
    );
}

export function HirePanel({
    company,
    data,
    members,
    offers,
    activity,
    activeTab,
    navItems,
    stats,
    detailedStats,
    isOwner,
    sidebarOpen,
    companyMenuOpen,
    leavingCompany,
    leaveCompanyError,
    inviteEmail,
    offerDraft,
    offersLoading,
    offersError,
    offersPagination,
    offersSearch,
    selectedOfferId,
    offerApplications,
    applicationsLoading,
    applicationsError,
    selectedApplication,
    applicationDetailLoading,
    updatingApplicationId,
    onTabChange,
    onOffersSearchChange,
    onOffersPageChange,
    onSelectOffer,
    onOpenApplication,
    onOpenApplicationResume,
    onUpdateApplicationStatus,
    onSidebarToggle,
    onOpenCreate,
    onCompanyMenuToggle,
    onLeaveCompany,
    onInviteEmailChange,
    onInviteMember,
    onKickMember,
    onOfferDraftChange,
    onCreateOffer,
}: {
    company: Company;
    data: CompanyData | null;
    members: Member[];
    offers: Offer[];
    activity: Activity[];
    activeTab: ActiveTab;
    navItems: HireNavItem[];
    stats: HireStat[];
    detailedStats: DetailedStat[];
    isOwner: boolean;
    sidebarOpen: boolean;
    companyMenuOpen: boolean;
    leavingCompany: boolean;
    leaveCompanyError: string | null;
    inviteEmail: string;
    offerDraft: OfferDraft;
    offersLoading: boolean;
    offersError: string | null;
    offersPagination: Pagination;
    offersSearch: string;
    selectedOfferId: number | null;
    offerApplications: CompanyApplication[];
    applicationsLoading: boolean;
    applicationsError: string | null;
    selectedApplication: CompanyApplication | null;
    applicationDetailLoading: boolean;
    updatingApplicationId: number | null;
    onTabChange: (tab: ActiveTab) => void;
    onOffersSearchChange: (value: string) => void;
    onOffersPageChange: (page: number) => void;
    onSelectOffer: (offerId: number) => void;
    onOpenApplication: (application: CompanyApplication) => void;
    onOpenApplicationResume: (application: CompanyApplication) => void;
    onUpdateApplicationStatus: (application: CompanyApplication, status: "accepted" | "rejected") => void;
    onSidebarToggle: () => void;
    onOpenCreate: () => void;
    onCompanyMenuToggle: () => void;
    onLeaveCompany: () => void;
    onInviteEmailChange: (value: string) => void;
    onInviteMember: (event: FormEvent) => void;
    onKickMember: (member: Member) => void;
    onOfferDraftChange: (draft: OfferDraft) => void;
    onCreateOffer: (event: FormEvent) => void;
}) {
    return (
        <main className="min-h-screen text-black">
            <div className="flex min-h-screen">
                <HireSidebar company={company} navItems={navItems} activeTab={activeTab} onTabChange={onTabChange} sidebarOpen={sidebarOpen} onSidebarToggle={onSidebarToggle} />
                <section id="overview" className="flex-1 px-4 py-9 sm:px-8 lg:px-12">
                    <HireHeader
                        company={company}
                        activeTab={activeTab}
                        navItems={navItems}
                        isOwner={isOwner}
                        sidebarOpen={sidebarOpen}
                        companyMenuOpen={companyMenuOpen}
                        leavingCompany={leavingCompany}
                        leaveCompanyError={leaveCompanyError}
                        onCreateClick={onOpenCreate}
                        onSidebarToggle={onSidebarToggle}
                        onMenuToggle={onCompanyMenuToggle}
                        onLeaveCompany={onLeaveCompany}
                    />
                    {(activeTab === "overview" || activeTab === "stats") && <StatCards stats={stats} />}
                    {activeTab === "stats" && <StatsPanel data={data} detailedStats={detailedStats} />}
                    {(activeTab === "overview" || activeTab === "offers" || activeTab === "members") && (
                        <div className={`grid gap-7 ${activeTab === "overview" ? "xl:grid-cols-[1.5fr_0.9fr]" : ""}`}>
                            {(activeTab === "overview" || activeTab === "offers") && (
                                <OffersPanel
                                    activeTab={activeTab}
                                    company={company}
                                    data={data}
                                    offers={offers}
                                    offersLoading={offersLoading}
                                    offersError={offersError}
                                    offersPagination={offersPagination}
                                    offersSearch={offersSearch}
                                    selectedOfferId={selectedOfferId}
                                    offerApplications={offerApplications}
                                    applicationsLoading={applicationsLoading}
                                    applicationsError={applicationsError}
                                    selectedApplication={selectedApplication}
                                    applicationDetailLoading={applicationDetailLoading}
                                    updatingApplicationId={updatingApplicationId}
                                    onShowAll={() => onTabChange("offers")}
                                    onOffersSearchChange={onOffersSearchChange}
                                    onOffersPageChange={onOffersPageChange}
                                    onSelectOffer={onSelectOffer}
                                    onOpenApplication={onOpenApplication}
                                    onOpenApplicationResume={onOpenApplicationResume}
                                    onUpdateApplicationStatus={onUpdateApplicationStatus}
                                />
                            )}
                            {(activeTab === "overview" || activeTab === "members") && (
                                <MembersPanel
                                    members={members}
                                    isOwner={isOwner}
                                    inviteEmail={inviteEmail}
                                    onInviteEmailChange={onInviteEmailChange}
                                    onInviteMember={onInviteMember}
                                    onKickMember={onKickMember}
                                />
                            )}
                        </div>
                    )}
                    {(activeTab === "overview" || activeTab === "activity") && <ActivityPanel activeTab={activeTab} activity={activity} />}
                    {activeTab === "create" && isOwner && (
                        <CreateOfferForm offerDraft={offerDraft} onDraftChange={onOfferDraftChange} onSubmit={onCreateOffer} />
                    )}
                </section>
            </div>
        </main>
    );
}
