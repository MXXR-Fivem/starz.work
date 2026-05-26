import type { ComponentType } from "react";
import type { iOffers } from "@/components/schemas/offerapi";

export type AdminTab = "overview" | "users" | "companies" | "offers" | "logs";

export type StaffData = {
    onlineOffersCount: number;
    allTimeOffersCount: number;
    usersCount: number;
    companiesCount: number;
    expiredHiredOffersCount: number;
    applicationsCount: number;
    acceptedApplicationsCount: number;
    applicationConversionRate: number;
    rejectedOffersCount: number;
    bannedUsersCount: number;
    newUsersLast7DaysCount: number;
    newUsersLast30DaysCount: number;
    averageApplicationProcessingHours: number | null;
    topCompanies: { id: number; name: string; offersCount: number; applicationsCount: number; acceptedApplicationsCount: number }[];
    topSkills: { id: number; name: string; offersCount: number }[];
};

export type StaffUser = {
    id: number;
    firstName: string;
    lastName: string;
    email: string | null;
    status: "en_recherche" | "recruteur";
    role: string;
    companyName: string | null;
    companyRole: "owner" | "member" | null;
    bannedAt: string | null;
    banReason: string | null;
};

export type StaffCompany = {
    id: number;
    name: string;
    slug: string | null;
    websiteUrl: string | null;
    membersCount: number;
    offersCount: number;
    createdAt: string;
};

export type Pagination = {
    page: number;
    size: number;
    total: number;
    totalPages: number;
};

export type SyncResult = {
    skipped: boolean;
    reason?: "disabled" | "missing_api_key";
    fetchedCount: number;
    insertedCount: number;
    totalCount: number;
    durationMs: number;
};

export type ModerationLogAction =
    | "offer_rejected"
    | "offer_archived"
    | "offer_restored"
    | "user_banned"
    | "user_unbanned"
    | "role_changed"
    | "other";

export type ModerationLog = {
    id: number;
    adminUserId: number;
    adminName: string;
    adminEmail: string | null;
    targetUserId: number | null;
    targetName: string | null;
    targetEmail: string | null;
    offerId: number | null;
    offerTitle: string | null;
    actionType: ModerationLogAction;
    reason: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
};

export type AdminStat = {
    label: string;
    value: number;
    hint: string;
    icon: ComponentType<{ className?: string }>;
};

export type AdminOffer = iOffers;
