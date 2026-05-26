'use client'

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/axios";
import { decodeHtmlEntities } from "@/lib/html";

type ApplicationStatus = "draft" | "submitted" | "viewed" | "accepted" | "rejected" | "withdrawn";

type ApiApplication = {
    id: number;
    status: ApplicationStatus;
    statusLabel: string;
    appliedAt: string;
    offer: {
        id: number;
        title: string;
        companyName: string;
        location: string | null;
    };
};

type Application = {
    id: number;
    title: string;
    company: string;
    location: string;
    status: string;
    date: string;
    offerHref: string;
    stage: "sent" | "review" | "accepted" | "rejected";
};

const tabs = [
    { key: "en-cours", label: "En cours" },
    { key: "terminees", label: "Terminées" },
];

const stageBadgeClass: Record<Application["stage"], string> = {
    sent: "bg-purple-100 text-purple-700",
    review: "bg-orange-100 text-orange-700",
    accepted: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
};

const toStage = (status: ApplicationStatus): Application["stage"] => {
    if (status === "accepted") return "accepted";
    if (status === "rejected" || status === "withdrawn") return "rejected";
    if (status === "viewed") return "review";
    return "sent";
};

const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate);
    return `Envoyée le ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
};

const mapApplication = (item: ApiApplication): Application => ({
    id: item.id,
    title: item.offer.title,
    company: item.offer.companyName,
    location: item.offer.location ?? "",
    status: item.statusLabel,
    date: formatDate(item.appliedAt),
    offerHref: `/offers/${item.offer.id}`,
    stage: toStage(item.status),
});

function ApplicationTimeline({ stage }: { stage: Application["stage"] }) {
    const steps = [
        { key: "sent", label: "Envoyé" },
        { key: "review", label: "En cours d'examen" },
        { key: stage === "rejected" ? "rejected" : "accepted", label: stage === "rejected" ? "Rejeté" : "Accepté" },
    ];

    return (
        <div className="rounded-full border border-black/10 bg-black/5 p-1 shadow-sm">
        <div className="flex overflow-hidden rounded-full">
            {steps.map((step, index) => {
            const isActive =
                stage === "sent" ? index === 0 :
                stage === "review" ? index <= 1 :
                index <= 2;
            const base = "flex-1 px-3 py-2 text-center text-xs leading-5 transition-colors duration-150";
            let variant = "bg-black/5 text-black/45";
            if (isActive) {
                if (step.key === "rejected") {
                variant = "bg-rose-100 text-rose-700";
                } else if (step.key === "accepted") {
                variant = "bg-emerald-100 text-emerald-700";
                } else if (step.key === "review") {
                variant = "bg-orange-100 text-orange-700";
                } else {
                variant = "bg-purple-100 text-purple-700";
                }
            }
            const border = index > 0 ? "border-l border-black/10" : "";
            return (
                <div key={step.key} className={`${base} ${variant} ${border}`}>
                {step.label}
                </div>
            );
            })}
        </div>
        </div>
    );
}

function ApplicationCard({ application }: { application: Application }) {
    return (
        <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-black/85">{decodeHtmlEntities(application.title)}</h3>
                    <p className="mt-1 text-sm text-gray-500">{application.company} · {application.location}</p>
                </div>
                <span className={`rounded-full px-4 py-1 text-sm font-semibold ${stageBadgeClass[application.stage]}`}>
                    {application.status}
                </span>
            </div>
            <div className="mt-1 grid gap-4 md:mt-5">
                <div className="hidden sm:block">
                    <ApplicationTimeline stage={application.stage} />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ">
                    <p className="text-sm text-gray-500 justify-center">{application.date}</p>
                    <Link href={application.offerHref} className="inline-flex min-w-40 items-center justify-center rounded-xl bg-[#6d4baf] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#56379c]">
                        Voir l&apos;offre
                    </Link>
                </div>
            </div>
        </article>
    );
}

export default function Applications() {
    const [activeTab, setActiveTab] = useState("en-cours");
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadApplications = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
        const endpoint = activeTab === "en-cours" ? "/applications" : "/applications/expired";
        const response = await api.get(endpoint, { params: { page: 0, size: 50 } });
        setApplications((response.data.data.items as ApiApplication[]).map(mapApplication));
        } catch {
        setError("Impossible de charger les candidatures.");
        } finally {
        setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
        loadApplications();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [loadApplications]);

    return (
        <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">
            <section className="rounded-2xl border border-thepurple/10 bg-white p-5 shadow-ombre">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h1 className="text-3xl font-semibold text-black/85">Mes candidatures</h1>
                    <div className="flex flex-wrap gap-3">
                        {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`rounded-xl px-5 py-2 text-sm font-semibold drop-shadow-[0px_3px_0.5px_rgba(0,0,0,0.2)] transition ${activeTab === tab.key ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                            {tab.label}
                        </button>
                        ))}
                    </div>
                </div>

                <div className="grid gap-4">
                    {loading && (
                        <div className="w-full flex justify-center py-6 text-black/40 text-sm">Chargement…</div>
                    )}
                    {error && (
                        <div className="w-full flex justify-center py-6 text-red-400 text-sm">{error}</div>
                    )}
                    {!loading && !error && applications.length === 0 && (
                        <div className="w-full flex justify-center py-12 text-black/40 text-sm">Aucune candidature trouvée.</div>
                    )}
                    {applications.map((application) => (
                        <ApplicationCard key={application.id} application={application} />
                    ))}
                </div>
            </section>
        </div>
    );
}
