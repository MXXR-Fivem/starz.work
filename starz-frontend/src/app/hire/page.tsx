"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FiBriefcase, FiClock, FiTrendingUp, FiUsers } from "react-icons/fi";
import {
    emptyOfferDraft,
    HireLanding,
    HireLoading,
    HirePanel,
} from "@/components/features/hire/hire-panel";
import type {
    ActiveTab,
    Activity,
    Company,
    CompanyApplication,
    CompanyData,
    Member,
    Offer,
    OfferDraft,
    Pagination,
} from "@/components/features/hire/types";
import { api } from "@/lib/axios";

const OFFERS_PAGE_SIZE = 10;

export default function HirePage() {
    const [company, setCompany] = useState<Company | null>(null);
    const [data, setData] = useState<CompanyData | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [offers, setOffers] = useState<Offer[]>([]);
    const [offersPagination, setOffersPagination] = useState<Pagination>({ page: 0, size: OFFERS_PAGE_SIZE, total: 0, totalPages: 0 });
    const [offersSearch, setOffersSearch] = useState("");
    const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
    const [offerApplications, setOfferApplications] = useState<CompanyApplication[]>([]);
    const [applicationsLoading, setApplicationsLoading] = useState(false);
    const [applicationsError, setApplicationsError] = useState<string | null>(null);
    const [selectedApplication, setSelectedApplication] = useState<CompanyApplication | null>(null);
    const [applicationDetailLoading, setApplicationDetailLoading] = useState(false);
    const [updatingApplicationId, setUpdatingApplicationId] = useState<number | null>(null);
    const [activity, setActivity] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [offersLoading, setOffersLoading] = useState(false);
    const [offersError, setOffersError] = useState<string | null>(null);
    const [isGuest, setIsGuest] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
    const [leavingCompany, setLeavingCompany] = useState(false);
    const [leaveCompanyError, setLeaveCompanyError] = useState<string | null>(null);
    const [companyName, setCompanyName] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");
    const [offerDraft, setOfferDraft] = useState<OfferDraft>(emptyOfferDraft);
    const isOwner = company?.role === "owner";

    const loadDashboard = async () => {
        setLoading(true);
        try {
            const companyResponse = await api.get("/company");
            const currentCompany = companyResponse.data.data.company as Company;
            const [dataResponse, membersResponse, offersResponse, activityResponse] = await Promise.all([
                api.get("/company/data"),
                api.get("/company/members"),
                api.get("/company/offers?size=4"),
                api.get("/company/activity"),
            ]);
            setCompany(currentCompany);
            setData(dataResponse.data.data);
            setMembers(membersResponse.data.data.members ?? []);
            setOffers(offersResponse.data.data.items ?? []);
            setActivity(activityResponse.data.data.activity ?? []);
            setIsGuest(false);
        } catch (error) {
            const status = (error as { response?: { status?: number } }).response?.status;
            setIsGuest(status === 401);
            setCompany(null);
        } finally {
            setLoading(false);
        }
    };

    const loadCompanyOffers = useCallback(async (page = 0, search = offersSearch) => {
        setOffersLoading(true);
        setOffersError(null);

        try {
            const response = await api.get("/company/offers", {
                params: { page, size: OFFERS_PAGE_SIZE, q: search || undefined },
            });
            const responseData = response.data.data;
            const items = (responseData.items ?? []) as Offer[];

            setOffers(items);
            setOffersPagination(responseData.pagination ?? { page, size: OFFERS_PAGE_SIZE, total: items.length, totalPages: items.length > 0 ? 1 : 0 });
            if (items.length === 0) {
                setOfferApplications([]);
                setSelectedApplication(null);
            }
            setSelectedOfferId((currentOfferId) => {
                if (currentOfferId && items.some((offer) => offer.id === currentOfferId)) return currentOfferId;
                return items[0]?.id ?? null;
            });
        } catch (error) {
            console.error("Failed to load company offers:", error);
            setOffersError("Impossible de charger les offres.");
        } finally {
            setOffersLoading(false);
        }
    }, [offersSearch]);

    const loadOfferApplications = useCallback(async (offerId: number) => {
        setApplicationsLoading(true);
        setApplicationsError(null);

        try {
            const response = await api.get(`/company/offers/${offerId}/applications`, {
                params: { page: 0, size: 100 },
            });
            const items = (response.data.data.items ?? []) as CompanyApplication[];
            setOfferApplications(items);
            setSelectedApplication((currentApplication) => {
                if (currentApplication && items.some((application) => application.id === currentApplication.id)) return currentApplication;
                return null;
            });
        } catch (error) {
            console.error("Failed to load offer applications:", error);
            setApplicationsError("Impossible de charger les candidatures.");
            setOfferApplications([]);
            setSelectedApplication(null);
        } finally {
            setApplicationsLoading(false);
        }
    }, []);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadDashboard();
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, []);

    useEffect(() => {
        if (activeTab !== "offers") return;

        const timeoutId = window.setTimeout(() => {
            void loadCompanyOffers(0, offersSearch);
        }, 250);

        return () => window.clearTimeout(timeoutId);
    }, [activeTab, loadCompanyOffers, offersSearch]);

    useEffect(() => {
        if (activeTab !== "offers" || selectedOfferId === null) return;

        const timeoutId = window.setTimeout(() => {
            void loadOfferApplications(selectedOfferId);
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [activeTab, selectedOfferId, loadOfferApplications]);

    const stats = useMemo(() => [
        { label: "Membres", value: members.length, hint: `${members.filter((member) => member.companyRole === "owner").length} gérant(s)`, icon: FiUsers },
        { label: "Offres en cours", value: data?.summary.activeOffersCount ?? 0, hint: "Offres visibles", icon: FiBriefcase },
        { label: "Candidatures", value: data?.summary.applicationsCount ?? 0, hint: `${data?.summary.acceptedApplicationsCount ?? 0} acceptée(s)`, icon: FiTrendingUp },
        { label: "En cours d'examen", value: data?.summary.pendingReviewApplicationsCount ?? 0, hint: "À traiter", icon: FiClock },
    ], [data, members]);

    const detailedStats = useMemo(() => [
        { label: "Offres totales", value: data?.summary.totalOffersCount ?? 0 },
        { label: "Offres désactivées", value: data?.summary.disabledOffersCount ?? 0 },
        { label: "Offres bientôt expirées", value: data?.summary.expiringSoonOffersCount ?? 0 },
        { label: "Candidatures acceptées", value: data?.summary.acceptedApplicationsCount ?? 0 },
        { label: "Candidatures rejetées", value: data?.summary.rejectedApplicationsCount ?? 0 },
        { label: "Taux d'acceptation", value: `${data?.summary.applicationAcceptanceRate ?? 0}%` },
        { label: "Taux de rejet", value: `${data?.summary.applicationRejectionRate ?? 0}%` },
        { label: "Délai moyen", value: data?.summary.averageApplicationProcessingHours === null || data?.summary.averageApplicationProcessingHours === undefined ? "N/A" : `${data.summary.averageApplicationProcessingHours}h` },
    ], [data]);

    const navItems = useMemo(() => [
        { key: "overview" as const, label: "Vue d'ensemble" },
        { key: "stats" as const, label: "Stats détaillées" },
        { key: "offers" as const, label: "Offres" },
        { key: "members" as const, label: "Membres" },
        { key: "activity" as const, label: "Activité" },
        ...(isOwner ? [{ key: "create" as const, label: "Créer une offre" }] : []),
    ], [isOwner]);

    const createCompany = async (event: FormEvent) => {
        event.preventDefault();
        await api.post("/company", { name: companyName });
        setCompanyName("");
        await loadDashboard();
    };

    const createOffer = async (event: FormEvent) => {
        event.preventDefault();
        const payload = {
            title: offerDraft.title,
            description: offerDraft.description,
            descriptionPreview: offerDraft.descriptionPreview || null,
            location: offerDraft.location || null,
            contractType: offerDraft.contractType || null,
            remotePolicy: offerDraft.remotePolicy || null,
            status: offerDraft.status,
            premium: offerDraft.premium,
            ...(offerDraft.salaryMin ? { salaryMin: Number(offerDraft.salaryMin) } : {}),
            ...(offerDraft.salaryMax ? { salaryMax: Number(offerDraft.salaryMax) } : {}),
        };

        await api.post("/company/offers", payload);
        setOfferDraft(emptyOfferDraft);
        await loadDashboard();
        setActiveTab("offers");
    };

    const inviteMember = async (event: FormEvent) => {
        event.preventDefault();
        if (!isOwner) return;
        await api.post("/company/invitations", { email: inviteEmail });
        setInviteEmail("");
    };

    const kickMember = async (member: Member) => {
        if (!isOwner || member.companyRole === "owner") return;
        await api.delete(`/company/members/${member.id}`);
        await loadDashboard();
    };

    const leaveCompany = async () => {
        setLeavingCompany(true);
        setLeaveCompanyError(null);

        try {
            await api.delete("/company/members/me");
            setCompanyMenuOpen(false);
            await loadDashboard();
        } catch (error) {
            const status = (error as { response?: { status?: number } }).response?.status;
            setLeaveCompanyError(status === 403
                ? "Vous devez nommer un autre gérant avant de quitter l'entreprise."
                : "Impossible de quitter l'entreprise.");
        } finally {
            setLeavingCompany(false);
        }
    };

    const openApplication = async (application: CompanyApplication) => {
        if (selectedOfferId === null) return;
        setApplicationDetailLoading(true);
        setApplicationsError(null);

        try {
            const response = await api.get(`/company/offers/${selectedOfferId}/applications/${application.id}`);
            const detail = response.data.data.application as CompanyApplication;
            setSelectedApplication(detail);
            setOfferApplications((applications) => applications.map((item) => item.id === detail.id ? detail : item));
        } catch (error) {
            console.error("Failed to open application:", error);
            setApplicationsError("Impossible d'ouvrir cette candidature.");
        } finally {
            setApplicationDetailLoading(false);
        }
    };

    const updateApplicationStatus = async (application: CompanyApplication, status: "accepted" | "rejected") => {
        if (selectedOfferId === null) return;
        setUpdatingApplicationId(application.id);
        setApplicationsError(null);

        try {
            const response = await api.patch(`/company/offers/${selectedOfferId}/applications/${application.id}/status`, { status });
            const updatedApplication = response.data.data.application as CompanyApplication;
            setSelectedApplication(updatedApplication);
            setOfferApplications((applications) => applications.map((item) => item.id === updatedApplication.id ? updatedApplication : item));
            await loadDashboard();
            await loadCompanyOffers(offersPagination.page, offersSearch);
        } catch (error) {
            console.error("Failed to update application status:", error);
            setApplicationsError("Impossible de mettre à jour la candidature.");
        } finally {
            setUpdatingApplicationId(null);
        }
    };

    const openApplicationResume = async (application: CompanyApplication) => {
        if (!application.resumeUrl) return;

        const resumeWindow = window.open("about:blank", "_blank");

        if (resumeWindow) {
            resumeWindow.opener = null;
            resumeWindow.document.title = "Chargement du CV";
            resumeWindow.document.body.textContent = "Chargement du CV...";
        }

        try {
            const response = await api.get<Blob>(application.resumeUrl, { responseType: "blob" });
            const blobUrl = window.URL.createObjectURL(response.data);

            if (resumeWindow) {
                resumeWindow.location.href = blobUrl;
                window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
                return;
            }

            const fallbackWindow = window.open(blobUrl, "_blank");
            if (fallbackWindow) {
                fallbackWindow.opener = null;
                window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
            }
        } catch (error) {
            resumeWindow?.close();
            console.error("Failed to open application resume:", error);
            setApplicationsError("Impossible d'ouvrir le CV.");
        }
    };

    if (loading) {
        return <HireLoading />;
    }

    if (!company) {
        return (
            <HireLanding
                isGuest={isGuest}
                companyName={companyName}
                onCompanyNameChange={setCompanyName}
                onCreateCompany={createCompany}
            />
        );
    }

    return (
        <HirePanel
            company={company}
            data={data}
            members={members}
            offers={offers}
            activity={activity}
            activeTab={activeTab}
            navItems={navItems}
            stats={stats}
            detailedStats={detailedStats}
            isOwner={Boolean(isOwner)}
            sidebarOpen={sidebarOpen}
            companyMenuOpen={companyMenuOpen}
            leavingCompany={leavingCompany}
            leaveCompanyError={leaveCompanyError}
            inviteEmail={inviteEmail}
            offerDraft={offerDraft}
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
            onTabChange={setActiveTab}
            onOffersSearchChange={setOffersSearch}
            onOffersPageChange={(page) => loadCompanyOffers(page, offersSearch)}
            onSelectOffer={setSelectedOfferId}
            onOpenApplication={openApplication}
            onOpenApplicationResume={openApplicationResume}
            onUpdateApplicationStatus={updateApplicationStatus}
            onSidebarToggle={() => setSidebarOpen((open) => !open)}
            onOpenCreate={() => setActiveTab("create")}
            onCompanyMenuToggle={() => {
                setLeaveCompanyError(null);
                setCompanyMenuOpen((open) => !open);
            }}
            onLeaveCompany={leaveCompany}
            onInviteEmailChange={setInviteEmail}
            onInviteMember={inviteMember}
            onKickMember={kickMember}
            onOfferDraftChange={setOfferDraft}
            onCreateOffer={createOffer}
        />
    );
}
