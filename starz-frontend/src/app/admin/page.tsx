"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FiBriefcase, FiCheck, FiShield, FiUsers } from "react-icons/fi";
import {
    AdminAccessError,
    AdminLoading,
    AdminPanel,
    defaultPagination,
} from "@/components/features/admin/admin-panel";
import type {
    AdminOffer,
    AdminTab,
    ModerationLog,
    StaffCompany,
    StaffData,
    StaffUser,
    SyncResult,
} from "@/components/features/admin/types";
import { api } from "@/lib/axios";

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState<AdminTab>("overview");
    const [data, setData] = useState<StaffData | null>(null);
    const [users, setUsers] = useState<StaffUser[]>([]);
    const [companies, setCompanies] = useState<StaffCompany[]>([]);
    const [offers, setOffers] = useState<AdminOffer[]>([]);
    const [logs, setLogs] = useState<ModerationLog[]>([]);
    const [userPage, setUserPage] = useState(0);
    const [companyPage, setCompanyPage] = useState(0);
    const [offerPage, setOfferPage] = useState(0);
    const [logsPage, setLogsPage] = useState(0);
    const [usersPagination, setUsersPagination] = useState(defaultPagination);
    const [companiesPagination, setCompaniesPagination] = useState(defaultPagination);
    const [offersPagination, setOffersPagination] = useState(defaultPagination);
    const [logsPagination, setLogsPagination] = useState(defaultPagination);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [userSearchDraft, setUserSearchDraft] = useState("");
    const [userSearch, setUserSearch] = useState("");
    const [companySearchDraft, setCompanySearchDraft] = useState("");
    const [companySearch, setCompanySearch] = useState("");
    const [offerSearchDraft, setOfferSearchDraft] = useState("");
    const [offerSearch, setOfferSearch] = useState("");

    const loadAdmin = useCallback(async () => {
        setLoading(true);
        setMessage(null);

        try {
            const [dataResponse, usersResponse, companiesResponse, offersResponse, logsResponse] = await Promise.all([
                api.get("/staff/data"),
                api.get("/staff/users", {
                    params: {
                        page: userPage,
                        size: 8,
                        ...(userSearch ? { q: userSearch } : {}),
                    },
                }),
                api.get("/staff/companies", {
                    params: {
                        page: companyPage,
                        size: 8,
                        ...(companySearch ? { q: companySearch } : {}),
                    },
                }),
                api.get("/staff/offers", {
                    params: {
                        page: offerPage,
                        size: 12,
                        ...(offerSearch ? { q: offerSearch } : {}),
                    },
                }),
                api.get("/staff/logs", {
                    params: {
                        page: logsPage,
                        size: 10,
                    },
                }),
            ]);

            setData(dataResponse.data.data);
            setUsers(usersResponse.data.data.items ?? []);
            setCompanies(companiesResponse.data.data.items ?? []);
            setOffers(offersResponse.data.data.items ?? []);
            setLogs(logsResponse.data.data.items ?? []);
            setUsersPagination(usersResponse.data.data.pagination ?? defaultPagination);
            setCompaniesPagination(companiesResponse.data.data.pagination ?? defaultPagination);
            setOffersPagination(offersResponse.data.data.pagination ?? defaultPagination);
            setLogsPagination(logsResponse.data.data.pagination ?? defaultPagination);
        } catch (error) {
            const status = (error as { response?: { status?: number } }).response?.status;
            setMessage(status === 403 ? "Accès réservé aux administrateurs." : "Impossible de charger l'administration.");
        } finally {
            setLoading(false);
        }
    }, [companyPage, companySearch, logsPage, offerPage, offerSearch, userPage, userSearch]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadAdmin();
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [loadAdmin]);

    const stats = useMemo(() => [
        { label: "Utilisateurs", value: data?.usersCount ?? 0, hint: `${data?.newUsersLast7DaysCount ?? 0} nouveaux sur 7j`, icon: FiUsers },
        { label: "Entreprises", value: data?.companiesCount ?? 0, hint: "Espaces recruteurs", icon: FiShield },
        { label: "Offres en ligne", value: data?.onlineOffersCount ?? 0, hint: `${data?.allTimeOffersCount ?? 0} au total`, icon: FiBriefcase },
        { label: "Candidatures", value: data?.applicationsCount ?? 0, hint: `${data?.applicationConversionRate ?? 0}% conversion`, icon: FiCheck },
    ], [data]);

    const banUser = async (user: StaffUser, reason: string) => {
        await api.patch(`/staff/users/${user.id}/ban`, { reason: reason.trim() || null });
        await loadAdmin();
    };

    const unbanUser = async (user: StaffUser) => {
        await api.patch(`/staff/users/${user.id}/unban`);
        await loadAdmin();
    };

    const deleteUser = async (user: StaffUser) => {
        await api.delete(`/staff/users/${user.id}`);
        await loadAdmin();
    };

    const deleteCompany = async (company: StaffCompany) => {
        await api.delete(`/staff/companies/${company.id}`);
        await loadAdmin();
    };

    const deleteOffer = async (offer: AdminOffer) => {
        await api.delete(`/staff/offers/${offer.id}`);
        await loadAdmin();
    };

    const updateOfferModeration = async (offer: AdminOffer, moderationStatus: AdminOffer["moderationStatus"]) => {
        await api.patch(`/staff/offers/${offer.id}/moderation-status`, { moderationStatus });
        await loadAdmin();
    };

    const syncWeLoveDevs = async () => {
        setSyncing(true);
        setMessage(null);

        try {
            const response = await api.post("/staff/welovedevs-sync");
            const result = response.data.data as SyncResult;
            const nextMessage = result.skipped
                ? result.reason === "missing_api_key"
                    ? "Sync WeLoveDevs ignorée : clé API manquante."
                    : "Sync WeLoveDevs ignorée."
                : `Sync WeLoveDevs terminée : ${result.insertedCount} nouvelle(s) offre(s), ${result.fetchedCount}/${result.totalCount} parcourue(s).`;

            await loadAdmin();
            setMessage(nextMessage);
        } catch {
            setMessage("Impossible de lancer la sync WeLoveDevs.");
        } finally {
            setSyncing(false);
        }
    };

    const submitUserSearch = (event: FormEvent) => {
        event.preventDefault();
        setUserPage(0);
        setUserSearch(userSearchDraft.trim());
    };

    const submitCompanySearch = (event: FormEvent) => {
        event.preventDefault();
        setCompanyPage(0);
        setCompanySearch(companySearchDraft.trim());
    };

    const submitOfferSearch = (event: FormEvent) => {
        event.preventDefault();
        setOfferPage(0);
        setOfferSearch(offerSearchDraft.trim());
    };

    if (loading) {
        return <AdminLoading />;
    }

    if (message && !data) {
        return <AdminAccessError message={message} />;
    }

    return (
        <AdminPanel
            activeTab={activeTab}
            data={data}
            stats={stats}
            users={users}
            companies={companies}
            offers={offers}
            logs={logs}
            message={message}
            syncing={syncing}
            userSearchDraft={userSearchDraft}
            companySearchDraft={companySearchDraft}
            offerSearchDraft={offerSearchDraft}
            usersPagination={usersPagination}
            companiesPagination={companiesPagination}
            offersPagination={offersPagination}
            logsPagination={logsPagination}
            onTabChange={setActiveTab}
            sidebarOpen={sidebarOpen}
            onSidebarToggle={() => setSidebarOpen((open) => !open)}
            onSync={syncWeLoveDevs}
            onCloseMessage={() => setMessage(null)}
            onBanUser={banUser}
            onUnbanUser={unbanUser}
            onDeleteUser={deleteUser}
            onDeleteCompany={deleteCompany}
            onDeleteOffer={deleteOffer}
            onUpdateOfferModeration={updateOfferModeration}
            onUserSearchDraftChange={setUserSearchDraft}
            onCompanySearchDraftChange={setCompanySearchDraft}
            onOfferSearchDraftChange={setOfferSearchDraft}
            onUserSearchSubmit={submitUserSearch}
            onCompanySearchSubmit={submitCompanySearch}
            onOfferSearchSubmit={submitOfferSearch}
            onUserPageChange={setUserPage}
            onCompanyPageChange={setCompanyPage}
            onOfferPageChange={setOfferPage}
            onLogsPageChange={setLogsPage}
        />
    );
}
