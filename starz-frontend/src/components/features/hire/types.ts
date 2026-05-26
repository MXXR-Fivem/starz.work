import type { ComponentType } from "react";

export type Company = { id: number; name: string; role: "owner" | "member" };

export type Summary = {
    totalOffersCount: number;
    activeOffersCount: number;
    disabledOffersCount: number;
    applicationsCount: number;
    pendingReviewApplicationsCount: number;
    acceptedApplicationsCount: number;
    rejectedApplicationsCount: number;
    expiringSoonOffersCount: number;
    applicationAcceptanceRate: number;
    applicationRejectionRate: number;
    averageApplicationProcessingHours: number | null;
};

export type Offer = {
    id: number;
    title: string;
    location?: string;
    status: "draft" | "published" | "closed";
    premium: boolean;
    viewsCount: number;
    applicationsCount: number;
    updatedAt: string;
};

export type Pagination = {
    page: number;
    size: number;
    total: number;
    totalPages: number;
};

export type CompanyApplicationStatus = "draft" | "submitted" | "viewed" | "accepted" | "rejected" | "withdrawn";

export type CompanyApplication = {
    id: number;
    status: CompanyApplicationStatus;
    statusLabel: string;
    coverLetter: string | null;
    resumeUrl: string | null;
    appliedAt: string;
    updatedAt: string;
    applicant: {
        id: number;
        firstName: string;
        lastName: string;
        email: string | null;
        profilePhotoUrl: string | null;
    };
    offer: {
        id: number;
        title: string;
    };
};

export type OfferPerformance = {
    offerId: number;
    title: string;
    premium: boolean;
    status: Offer["status"];
    applicationsCount: number;
    reviewedApplicationsCount: number;
    acceptedApplicationsCount: number;
    rejectedApplicationsCount: number;
    acceptanceRate: number;
    rejectionRate: number;
};

export type PremiumPerformance = {
    type: "premium" | "standard";
    offersCount: number;
    applicationsCount: number;
    acceptedApplicationsCount: number;
    acceptanceRate: number;
};

export type CompanyData = {
    summary: Summary;
    offerPerformance: OfferPerformance[];
    premiumPerformance: PremiumPerformance[];
};

export type Member = {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    companyRole: "owner" | "member";
};

export type Activity = {
    type: "application" | "offer";
    title: string;
    description: string;
    createdAt: string;
    ageSeconds?: number;
};

export type ActiveTab = "overview" | "stats" | "offers" | "members" | "activity" | "create";

export type OfferDraft = {
    title: string;
    description: string;
    descriptionPreview: string;
    location: string;
    contractType: string;
    remotePolicy: string;
    status: Offer["status"];
    salaryMin: string;
    salaryMax: string;
    premium: boolean;
};

export type HireStat = {
    label: string;
    value: number;
    hint: string;
    icon: ComponentType<{ className?: string }>;
};

export type DetailedStat = {
    label: string;
    value: string | number;
};

export type HireNavItem = {
    key: ActiveTab;
    label: string;
};
