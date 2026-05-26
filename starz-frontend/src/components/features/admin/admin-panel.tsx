"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FiActivity, FiCheck, FiHome, FiMenu, FiRefreshCw, FiSearch, FiShield, FiSlash, FiTrash2, FiX } from "react-icons/fi";
import { Logo } from "@/components/assets/logo";
import { decodeHtmlEntities } from "@/lib/html";
import { formatContractType } from "@/lib/offerLabels";
import type { AdminOffer, AdminStat, AdminTab, ModerationLog, ModerationLogAction, Pagination, StaffCompany, StaffData, StaffUser } from "./types";

export const adminTabs: { key: AdminTab; label: string }[] = [
    { key: "overview", label: "Vue d'ensemble" },
    { key: "users", label: "Utilisateurs" },
    { key: "companies", label: "Entreprises" },
    { key: "offers", label: "Offres" },
    { key: "logs", label: "Logs" },
];

export const defaultPagination: Pagination = { page: 0, size: 0, total: 0, totalPages: 0 };

const roleLabel = (role: string) => role === "admin" ? "Admin" : "Utilisateur";
const moderationLabel = (status: AdminOffer["moderationStatus"]) => status === "approved" ? "Approuvée" : "Rejetée";
const offerStatusLabel = (status: AdminOffer["status"]) => status === "published" ? "Publiée" : status === "closed" ? "Fermée" : "Brouillon";
const actionLabel = (action: ModerationLogAction) => ({
    offer_rejected: "Offre rejetée",
    offer_archived: "Offre archivée",
    offer_restored: "Offre restaurée",
    user_banned: "Utilisateur banni",
    user_unbanned: "Utilisateur débanni",
    role_changed: "Rôle modifié",
    other: "Action admin",
}[action]);

const formatLogDate = (value: string) => new Date(value).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
});

const metadataPreview = (metadata: Record<string, unknown> | null): string | null => {
    if (!metadata) return null;
    const entries = Object.entries(metadata)
        .filter(([, value]) => value !== null && value !== undefined)
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);

    return entries.length > 0 ? entries.join(" · ") : null;
};

export function AdminLoading() {
    return <main className="flex min-h-screen items-center justify-center text-black/55">Chargement...</main>;
}

export function AdminAccessError({ message }: { message: string }) {
    return (
        <main className="flex min-h-screen items-center justify-center px-8 text-black">
            <div className="rounded-2xl border border-thepurple/10 bg-white p-6 text-center shadow-ombre">
                <p className="font-bold text-black/75">{message}</p>
                <Link href="/profile" replace className="mt-4 inline-flex rounded-xl bg-thepurple px-4 py-2 text-sm font-bold text-white">Retour profil</Link>
            </div>
        </main>
    );
}

function AdminSidebar({
    activeTab,
    sidebarOpen,
    onTabChange,
    onSidebarToggle,
}: {
    activeTab: AdminTab;
    sidebarOpen: boolean;
    onTabChange: (tab: AdminTab) => void;
    onSidebarToggle: () => void;
}) {
    return (
        <>
            <aside className="hidden lg:flex sticky top-0 h-screen w-[300px] flex-col border-r border-thepurple/10 bg-white/80 px-6 py-8 shadow-[8px_0_30px_rgba(111,45,189,0.07)]">
                <Link href="/" aria-label="Accueil Starz" className="mb-12 flex h-14 w-full items-center justify-center px-3">
                    <Logo className="h-12 w-52 overflow-visible drop-shadow-[0px_3px_0.5px_rgba(0,0,0,0.18)]" />
                </Link>
                <nav className="flex flex-col gap-2 text-sm font-semibold text-black/55">
                    {adminTabs.map((item) => (
                        <button key={item.key} type="button" onClick={() => onTabChange(item.key)} className={`rounded-xl px-4 py-3 text-left transition-colors ${activeTab === item.key ? "bg-thepurple text-white shadow-[0_8px_24px_rgba(111,45,189,0.22)]" : "hover:bg-thepurple/10 hover:text-thepurple"}`}>
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="mt-auto rounded-2xl border border-thepurple/10 bg-page p-4">
                    <p className="text-sm font-bold text-black/75">Administration</p>
                    <p className="mt-1 text-xs text-black/40">Admin</p>
                </div>
                <Link href="/profile" replace className="mt-3 inline-flex items-center gap-2 rounded-xl border border-thepurple/15 bg-white px-4 py-3 text-sm font-semibold text-black/55 hover:border-thepurple/40 hover:text-thepurple"><FiHome />Retour profil</Link>
            </aside>
            {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onSidebarToggle} />}
            <aside className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-thepurple/10 bg-white px-6 py-8 shadow-[8px_0_30px_rgba(111,45,189,0.07)] transition-transform duration-200 lg:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <Link href="/" aria-label="Accueil Starz" className="mb-12 flex h-14 w-full items-center justify-center px-3">
                    <Logo className="h-12 w-52 overflow-visible drop-shadow-[0px_3px_0.5px_rgba(0,0,0,0.18)]" />
                </Link>
                <nav className="flex flex-col gap-2 text-sm font-semibold text-black/55">
                    {adminTabs.map((item) => (
                        <button key={item.key} type="button" onClick={() => { onTabChange(item.key); onSidebarToggle(); }} className={`rounded-xl px-4 py-3 text-left transition-colors ${activeTab === item.key ? "bg-thepurple text-white shadow-[0_8px_24px_rgba(111,45,189,0.22)]" : "hover:bg-thepurple/10 hover:text-thepurple"}`}>
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="mt-auto rounded-2xl border border-thepurple/10 bg-page p-4">
                    <p className="text-sm font-bold text-black/75">Administration</p>
                    <p className="mt-1 text-xs text-black/40">Admin</p>
                </div>
                <Link href="/profile" replace onClick={onSidebarToggle} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-thepurple/15 bg-white px-4 py-3 text-sm font-semibold text-black/55 hover:border-thepurple/40 hover:text-thepurple"><FiHome />Retour profil</Link>
            </aside>
        </>
    );
}

function AdminHeader({
    activeTab,
    sidebarOpen,
    syncing,
    onSidebarToggle,
    onSync,
}: {
    activeTab: AdminTab;
    sidebarOpen: boolean;
    syncing: boolean;
    onSidebarToggle: () => void;
    onSync: () => void;
}) {
    return (
        <header className="mb-9 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <button onClick={onSidebarToggle} className="flex h-10 w-10 items-center justify-center rounded-xl text-black/60 transition-colors hover:bg-black/5 lg:hidden" aria-label="Menu">
                    {sidebarOpen ? <FiX className="h-6 w-6" /> : <FiMenu className="h-6 w-6" />}
                </button>
                <div>
                    <h1 className="text-3xl font-black text-black/85">{adminTabs.find((item) => item.key === activeTab)?.label}</h1>
                    <p className="mt-2 text-black/50">Pilotage global des utilisateurs, entreprises et offres.</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onSync}
                    disabled={syncing}
                    className="inline-flex items-center gap-2 rounded-xl bg-thepurple px-4 py-2 text-sm font-bold text-white shadow-[0_8px_22px_rgba(111,45,189,0.28)] transition-all hover:scale-[1.02] hover:bg-thepurple/90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                    <FiRefreshCw className={syncing ? "animate-spin" : ""} />
                    {syncing ? "Sync..." : "Sync WeLoveDevs"}
                </button>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-thepurple text-white shadow-ombre"><FiShield /></div>
            </div>
        </header>
    );
}

function AdminMessage({ message, onClose }: { message: string; onClose: () => void }) {
    return (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-500">
            <p>{message}</p>
            <button
                type="button"
                onClick={onClose}
                aria-label="Fermer la notification"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
            >
                <FiX />
            </button>
        </div>
    );
}

function PaginationControls({
    pagination,
    onPageChange,
}: {
    pagination: Pagination;
    onPageChange: (page: number) => void;
}) {
    if (pagination.totalPages <= 1) return null;

    return (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
            <p className="text-sm font-semibold text-black/45">
                Page {pagination.page + 1} / {pagination.totalPages} · {pagination.total} résultat(s)
            </p>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => onPageChange(Math.max(0, pagination.page - 1))}
                    disabled={pagination.page <= 0}
                    className="rounded-xl border border-black/10 px-4 py-2 text-sm font-bold text-black/55 transition-colors hover:border-thepurple/30 hover:text-thepurple disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Précédent
                </button>
                <button
                    type="button"
                    onClick={() => onPageChange(Math.min(pagination.totalPages - 1, pagination.page + 1))}
                    disabled={pagination.page + 1 >= pagination.totalPages}
                    className="rounded-xl border border-black/10 px-4 py-2 text-sm font-bold text-black/55 transition-colors hover:border-thepurple/30 hover:text-thepurple disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Suivant
                </button>
            </div>
        </div>
    );
}

function SearchForm({
    value,
    placeholder,
    onChange,
    onSubmit,
}: {
    value: string;
    placeholder: string;
    onChange: (value: string) => void;
    onSubmit: (event: FormEvent) => void;
}) {
    return (
        <form onSubmit={onSubmit} className="mb-5 flex flex-wrap gap-2">
            <div className="relative min-w-0 flex-1">
                <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-thepurple/60" />
                <input
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-black/10 py-2.5 pl-9 pr-3 text-sm text-black/70 outline-none focus:border-thepurple/40"
                />
            </div>
            <button className="rounded-xl bg-thepurple px-4 py-2.5 text-sm font-bold text-white hover:bg-thepurple/90">Rechercher</button>
        </form>
    );
}

function StatsGrid({ stats }: { stats: AdminStat[] }) {
    return (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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

function OverviewPanel({ data, stats }: { data: StaffData | null; stats: AdminStat[] }) {
    return (
        <div className="grid gap-7">
            <StatsGrid stats={stats} />
            <div className="grid gap-7 xl:grid-cols-2">
                <article className="rounded-2xl border border-thepurple/10 bg-white p-6 shadow-ombre">
                    <h2 className="mb-5 text-xl font-bold text-black/80">Top entreprises</h2>
                    {(data?.topCompanies ?? []).map((company) => (
                        <div key={company.id} className="border-t border-black/10 py-4 first:border-t-0">
                            <div className="flex items-center justify-between gap-3">
                                <p className="font-bold text-black/75">{company.name}</p>
                                <span className="rounded-full bg-thepurple/10 px-3 py-1 text-xs font-bold text-thepurple">{company.applicationsCount} candidatures</span>
                            </div>
                            <p className="mt-1 text-sm text-black/40">{company.offersCount} offres · {company.acceptedApplicationsCount} acceptées</p>
                        </div>
                    ))}
                </article>
                <article className="rounded-2xl border border-thepurple/10 bg-white p-6 shadow-ombre">
                    <h2 className="mb-5 text-xl font-bold text-black/80">Skills demandés</h2>
                    <div className="flex flex-wrap gap-2">
                        {(data?.topSkills ?? []).map((skill) => (
                            <span key={skill.id} className="rounded-full bg-thepurple/10 px-3 py-1.5 text-sm font-bold text-thepurple">{skill.name} · {skill.offersCount}</span>
                        ))}
                    </div>
                </article>
            </div>
        </div>
    );
}

function UsersPanel({
    users,
    searchValue,
    pagination,
    onSearchChange,
    onSearchSubmit,
    onPageChange,
    onBan,
    onUnban,
    onDelete,
}: {
    users: StaffUser[];
    searchValue: string;
    pagination: Pagination;
    onSearchChange: (value: string) => void;
    onSearchSubmit: (event: FormEvent) => void;
    onPageChange: (page: number) => void;
    onBan: (user: StaffUser, reason: string) => void;
    onUnban: (user: StaffUser) => void;
    onDelete: (user: StaffUser) => void;
}) {
    const [banReasons, setBanReasons] = useState<Record<number, string>>({});

    return (
        <article className="rounded-2xl border border-thepurple/10 bg-white p-6 shadow-ombre">
            <SearchForm value={searchValue} onChange={onSearchChange} onSubmit={onSearchSubmit} placeholder="Rechercher un utilisateur..." />
            {users.map((user) => (
                <div key={user.id} className="grid gap-3 border-t border-black/10 py-4 first:border-t-0 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                        <p className="font-bold text-black/75">{user.firstName} {user.lastName}</p>
                        <p className="text-sm text-black/40">{user.email ?? "Email absent"} · {roleLabel(user.role)} · {user.companyName ?? "Sans entreprise"}</p>
                        {user.bannedAt && <p className="mt-1 text-xs font-bold text-red-400">Banni : {user.banReason || "sans raison"}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {user.role !== "admin" && (user.bannedAt ? (
                            <button onClick={() => onUnban(user)} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-600 hover:bg-emerald-50"><FiCheck />Débannir</button>
                        ) : (
                            <>
                                <input
                                    value={banReasons[user.id] ?? ""}
                                    onChange={(event) => setBanReasons({ ...banReasons, [user.id]: event.target.value })}
                                    placeholder="Raison du ban"
                                    className="min-w-[190px] rounded-xl border border-black/10 px-3 py-2 text-sm text-black/70 outline-none focus:border-thepurple/40"
                                />
                                <button onClick={() => onBan(user, banReasons[user.id] ?? "")} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 px-3 py-2 text-sm font-bold text-amber-600 hover:bg-amber-50"><FiSlash />Bannir</button>
                            </>
                        ))}
                        {user.role !== "admin" && <button onClick={() => onDelete(user)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50"><FiTrash2 />Supprimer</button>}
                    </div>
                </div>
            ))}
            {users.length === 0 && <p className="border-t border-black/10 py-5 text-sm text-black/40">Aucun utilisateur trouvé.</p>}
            <PaginationControls pagination={pagination} onPageChange={onPageChange} />
        </article>
    );
}

function CompaniesPanel({
    companies,
    searchValue,
    pagination,
    onSearchChange,
    onSearchSubmit,
    onPageChange,
    onDelete,
}: {
    companies: StaffCompany[];
    searchValue: string;
    pagination: Pagination;
    onSearchChange: (value: string) => void;
    onSearchSubmit: (event: FormEvent) => void;
    onPageChange: (page: number) => void;
    onDelete: (company: StaffCompany) => void;
}) {
    return (
        <article className="rounded-2xl border border-thepurple/10 bg-white p-6 shadow-ombre">
            <SearchForm value={searchValue} onChange={onSearchChange} onSubmit={onSearchSubmit} placeholder="Rechercher une entreprise..." />
            {companies.map((company) => (
                <div key={company.id} className="grid gap-3 border-t border-black/10 py-4 first:border-t-0 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                        <p className="font-bold text-black/75">{company.name}</p>
                        <p className="text-sm text-black/40">{company.membersCount} membres · {company.offersCount} offres · {company.websiteUrl ?? company.slug ?? "Aucun site"}</p>
                    </div>
                    <button onClick={() => onDelete(company)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50"><FiTrash2 />Supprimer</button>
                </div>
            ))}
            {companies.length === 0 && <p className="border-t border-black/10 py-5 text-sm text-black/40">Aucune entreprise trouvée.</p>}
            <PaginationControls pagination={pagination} onPageChange={onPageChange} />
        </article>
    );
}

function OffersPanel({
    offers,
    searchValue,
    pagination,
    onSearchChange,
    onSearchSubmit,
    onPageChange,
    onDelete,
    onModerationChange,
}: {
    offers: AdminOffer[];
    searchValue: string;
    pagination: Pagination;
    onSearchChange: (value: string) => void;
    onSearchSubmit: (event: FormEvent) => void;
    onPageChange: (page: number) => void;
    onDelete: (offer: AdminOffer) => void;
    onModerationChange: (offer: AdminOffer, moderationStatus: AdminOffer["moderationStatus"]) => void;
}) {
    return (
        <article className="rounded-2xl border border-thepurple/10 bg-white p-6 shadow-ombre">
            <SearchForm value={searchValue} onChange={onSearchChange} onSubmit={onSearchSubmit} placeholder="Rechercher une offre..." />
            {offers.map((offer) => (
                <div key={offer.id} className="grid gap-3 border-t border-black/10 py-4 first:border-t-0 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                        <p className="font-bold text-black/75">{decodeHtmlEntities(offer.title)}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold">
                            <span className="rounded-full bg-thepurple/10 px-2.5 py-1 text-thepurple">{offer.companyName}</span>
                            <span className="rounded-full bg-black/5 px-2.5 py-1 text-black/55">{offerStatusLabel(offer.status)}</span>
                            <span className={`rounded-full px-2.5 py-1 ${offer.moderationStatus === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-500"}`}>{moderationLabel(offer.moderationStatus)}</span>
                            {offer.contractType && <span className="rounded-full bg-black/5 px-2.5 py-1 text-black/55">{formatContractType(offer.contractType)}</span>}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {offer.moderationStatus !== "approved" && <button onClick={() => onModerationChange(offer, "approved")} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-bold text-emerald-600 hover:bg-emerald-50"><FiCheck />Approuver</button>}
                        {offer.moderationStatus !== "rejected" && <button onClick={() => onModerationChange(offer, "rejected")} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 px-3 py-2 text-sm font-bold text-amber-600 hover:bg-amber-50"><FiX />Rejeter</button>}
                        <button onClick={() => onDelete(offer)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50"><FiTrash2 />Supprimer</button>
                    </div>
                </div>
            ))}
            {offers.length === 0 && <p className="border-t border-black/10 py-5 text-sm text-black/40">Aucune offre trouvée.</p>}
            <PaginationControls pagination={pagination} onPageChange={onPageChange} />
        </article>
    );
}

function LogsPanel({
    logs,
    pagination,
    onPageChange,
}: {
    logs: ModerationLog[];
    pagination: Pagination;
    onPageChange: (page: number) => void;
}) {
    return (
        <article className="rounded-2xl border border-thepurple/10 bg-white p-4 shadow-ombre sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-black text-black/80">Journal d&apos;administration</h2>
                    <p className="mt-1 text-sm text-black/45">Actions sensibles réalisées par les administrateurs.</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-thepurple/10 text-thepurple">
                    <FiActivity className="h-5 w-5" />
                </div>
            </div>
            <div className="flex flex-col">
                {logs.map((log) => {
                    const preview = metadataPreview(log.metadata);
                    return (
                        <div key={log.id} className="grid gap-3 border-t border-black/10 py-4 first:border-t-0 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-thepurple/10 px-2.5 py-1 text-xs font-bold text-thepurple">{actionLabel(log.actionType)}</span>
                                    <span className="text-xs font-semibold text-black/35">{formatLogDate(log.createdAt)}</span>
                                </div>
                                <p className="mt-2 text-sm font-bold text-black/75">
                                    {log.adminName}
                                    {log.targetName && <span className="font-semibold text-black/45"> → {log.targetName}</span>}
                                    {log.offerTitle && <span className="font-semibold text-black/45"> · {decodeHtmlEntities(log.offerTitle)}</span>}
                                </p>
                                {log.reason && <p className="mt-1 text-sm text-black/50">Raison : {log.reason}</p>}
                                {preview && <p className="mt-1 break-words text-xs text-black/35">{preview}</p>}
                            </div>
                            <div className="text-left text-xs font-semibold text-black/35 lg:text-right">
                                #{log.id}
                            </div>
                        </div>
                    );
                })}
            </div>
            {logs.length === 0 && <p className="border-t border-black/10 py-5 text-sm text-black/40">Aucun log pour le moment.</p>}
            <PaginationControls pagination={pagination} onPageChange={onPageChange} />
        </article>
    );
}

export function AdminPanel({
    activeTab,
    data,
    stats,
    users,
    companies,
    offers,
    logs,
    message,
    syncing,
    userSearchDraft,
    companySearchDraft,
    offerSearchDraft,
    usersPagination,
    companiesPagination,
    offersPagination,
    logsPagination,
    sidebarOpen,
    onTabChange,
    onSidebarToggle,
    onSync,
    onCloseMessage,
    onBanUser,
    onUnbanUser,
    onDeleteUser,
    onDeleteCompany,
    onDeleteOffer,
    onUpdateOfferModeration,
    onUserSearchDraftChange,
    onCompanySearchDraftChange,
    onOfferSearchDraftChange,
    onUserSearchSubmit,
    onCompanySearchSubmit,
    onOfferSearchSubmit,
    onUserPageChange,
    onCompanyPageChange,
    onOfferPageChange,
    onLogsPageChange,
}: {
    activeTab: AdminTab;
    data: StaffData | null;
    stats: AdminStat[];
    users: StaffUser[];
    companies: StaffCompany[];
    offers: AdminOffer[];
    logs: ModerationLog[];
    message: string | null;
    syncing: boolean;
    userSearchDraft: string;
    companySearchDraft: string;
    offerSearchDraft: string;
    usersPagination: Pagination;
    companiesPagination: Pagination;
    offersPagination: Pagination;
    logsPagination: Pagination;
    sidebarOpen: boolean;
    onTabChange: (tab: AdminTab) => void;
    onSidebarToggle: () => void;
    onSync: () => void;
    onCloseMessage: () => void;
    onBanUser: (user: StaffUser, reason: string) => void;
    onUnbanUser: (user: StaffUser) => void;
    onDeleteUser: (user: StaffUser) => void;
    onDeleteCompany: (company: StaffCompany) => void;
    onDeleteOffer: (offer: AdminOffer) => void;
    onUpdateOfferModeration: (offer: AdminOffer, moderationStatus: AdminOffer["moderationStatus"]) => void;
    onUserSearchDraftChange: (value: string) => void;
    onCompanySearchDraftChange: (value: string) => void;
    onOfferSearchDraftChange: (value: string) => void;
    onUserSearchSubmit: (event: FormEvent) => void;
    onCompanySearchSubmit: (event: FormEvent) => void;
    onOfferSearchSubmit: (event: FormEvent) => void;
    onUserPageChange: (page: number) => void;
    onCompanyPageChange: (page: number) => void;
    onOfferPageChange: (page: number) => void;
    onLogsPageChange: (page: number) => void;
}) {
    return (
        <main className="min-h-screen text-black">
            <div className="flex min-h-screen">
                <AdminSidebar activeTab={activeTab} sidebarOpen={sidebarOpen} onTabChange={onTabChange} onSidebarToggle={onSidebarToggle} />
                <section className="flex-1 px-4 py-9 sm:px-8 lg:px-12">
                    <AdminHeader activeTab={activeTab} sidebarOpen={sidebarOpen} syncing={syncing} onSidebarToggle={onSidebarToggle} onSync={onSync} />
                    {message && <AdminMessage message={message} onClose={onCloseMessage} />}
                    {activeTab === "overview" && <OverviewPanel data={data} stats={stats} />}
                    {activeTab === "users" && (
                        <UsersPanel
                            users={users}
                            searchValue={userSearchDraft}
                            pagination={usersPagination}
                            onSearchChange={onUserSearchDraftChange}
                            onSearchSubmit={onUserSearchSubmit}
                            onPageChange={onUserPageChange}
                            onBan={onBanUser}
                            onUnban={onUnbanUser}
                            onDelete={onDeleteUser}
                        />
                    )}
                    {activeTab === "companies" && (
                        <CompaniesPanel
                            companies={companies}
                            searchValue={companySearchDraft}
                            pagination={companiesPagination}
                            onSearchChange={onCompanySearchDraftChange}
                            onSearchSubmit={onCompanySearchSubmit}
                            onPageChange={onCompanyPageChange}
                            onDelete={onDeleteCompany}
                        />
                    )}
                    {activeTab === "offers" && (
                        <OffersPanel
                            offers={offers}
                            searchValue={offerSearchDraft}
                            pagination={offersPagination}
                            onSearchChange={onOfferSearchDraftChange}
                            onSearchSubmit={onOfferSearchSubmit}
                            onPageChange={onOfferPageChange}
                            onDelete={onDeleteOffer}
                            onModerationChange={onUpdateOfferModeration}
                        />
                    )}
                    {activeTab === "logs" && (
                        <LogsPanel
                            logs={logs}
                            pagination={logsPagination}
                            onPageChange={onLogsPageChange}
                        />
                    )}
                </section>
            </div>
        </main>
    );
}
