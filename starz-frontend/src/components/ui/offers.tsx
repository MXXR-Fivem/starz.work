"use client";

import Cardoffer from "./cardoffer";
import { api } from "@/lib/axios";
import { iOffers } from "@/components/schemas/offerapi";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiFilter, FiX } from "react-icons/fi";

type OfferFilters = {
    city?: string;
    radiusKm?: number;
    contractType?: string;
    remotePolicy?: string;
    premium?: boolean;
    favoritesOnly?: boolean;
    salaryMin?: number;
    salaryMax?: number;
    skillIds?: string;
    skills?: string;
    sortBy?: "premiumThenDate";
    sortOrder?: "asc";
};

type OfferSearchParams = OfferFilters & {
    q?: string;
    location?: string;
    page: number;
    size: number;
};

type FilterFormState = {
    distanceKm: number;
    contractType: string;
    remotePolicy: string;
    salaryMin: string;
    salaryMax: string;
    premium: string;
    favoritesOnly: boolean;
};

type FilterSubmitEvent = {
    preventDefault: () => void;
};

const defaultFilterForm: FilterFormState = {
    distanceKm: 50,
    contractType: "",
    remotePolicy: "",
    salaryMin: "",
    salaryMax: "",
    premium: "",
    favoritesOnly: false,
};

type FavoriteListItem = {
    offer: {
        id: number;
        companyId: number;
        companyName: string;
        title: string;
        descriptionPreview: string | null;
        location: string | null;
        contractType: string | null;
        remotePolicy: string | null;
        status: "draft" | "published" | "closed";
        moderationStatus: "approved" | "rejected";
        expiresAt: string | null;
        salaryPeriod?: "yearly" | "daily" | null;
    };
};

const contractTypeOptions = [
    { label: "Tous", value: "" },
    { label: "CDI", value: "CDI" },
    { label: "CDD", value: "CDD" },
    { label: "Stage", value: "Stage" },
    { label: "Alternance", value: "Alternance" },
    { label: "Freelance", value: "Freelance" },
];

const remotePolicyOptions = [
    { label: "Tous", value: "" },
    { label: "Télétravail complet", value: "full" },
    { label: "Télétravail partiel", value: "partial" },
    { label: "Sur site", value: "none" },
];

const filterSelectClassName =
    "w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black/70 outline-none focus:border-thepurple/50";

const filterRangeClassName =
    "h-2 w-full cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:border-0 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-thepurple [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:border-0 [&::-moz-range-track]:bg-transparent [&::-moz-range-progress]:h-2 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:border-0 [&::-moz-range-progress]:bg-thepurple [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-thepurple";

const getTrimmedQueryParam = (params: URLSearchParams, key: string): string | undefined => {
    const value = params.get(key)?.trim();
    return value ? value : undefined;
};

const getPositiveNumber = (value: string): number | undefined => {
    if (!value.trim()) return undefined;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : undefined;
};

const cleanSearchParams = (params: OfferSearchParams): OfferSearchParams => {
    const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== "");
    return Object.fromEntries(entries) as OfferSearchParams;
};

const toOfferFilters = (filterForm: FilterFormState): OfferFilters => ({
    radiusKm: filterForm.distanceKm,
    contractType: filterForm.contractType || undefined,
    remotePolicy: filterForm.remotePolicy || undefined,
    salaryMin: getPositiveNumber(filterForm.salaryMin),
    salaryMax: getPositiveNumber(filterForm.salaryMax),
    premium: filterForm.premium === "" ? undefined : filterForm.premium === "true",
    favoritesOnly: filterForm.favoritesOnly || undefined,
    sortBy: "premiumThenDate",
    sortOrder: "asc",
});

const toFavoriteOffer = ({ offer }: FavoriteListItem): iOffers => ({
    id: offer.id,
    companyId: offer.companyId,
    companyName: offer.companyName,
    title: offer.title,
    descriptionPreview: offer.descriptionPreview ?? undefined,
    location: offer.location ?? undefined,
    contractType: offer.contractType ?? undefined,
    remotePolicy: offer.remotePolicy ?? undefined,
    status: offer.status,
    moderationStatus: offer.moderationStatus,
    premium: false,
    salaryCurrency: "EUR",
    salaryPeriod: offer.salaryPeriod ?? "yearly",
    skills: [],
    createdAt: "",
    updatedAt: "",
});

const buildOfferSearchParams = (
    searchParams: URLSearchParams,
    page: number,
    filters: OfferFilters = {}
): OfferSearchParams => {
    const location = getTrimmedQueryParam(searchParams, "location");
    const params = cleanSearchParams({
        page,
        size: 20,
        q: getTrimmedQueryParam(searchParams, "q"),
        location,
        city: location,
        ...filters,
    });
    if (!location) delete params.radiusKm;
    return params;
};

const mergeUniqueOffers = (previousOffers: iOffers[], nextOffers: iOffers[]): iOffers[] => {
    const offersById = new Map<number, iOffers>();
    for (const offer of [...previousOffers, ...nextOffers]) offersById.set(offer.id, offer);
    return Array.from(offersById.values());
};

function FilterPanel({
    draftFilters,
    setDraftFilters,
    hasLocationFilter,
    distanceFillPercent,
    onSubmit,
    onReset,
    onClose,
}: {
    draftFilters: FilterFormState;
    setDraftFilters: React.Dispatch<React.SetStateAction<FilterFormState>>;
    hasLocationFilter: boolean;
    distanceFillPercent: number;
    onSubmit: (event: FilterSubmitEvent) => void;
    onReset: () => void;
    onClose?: () => void;
}) {
    return (
        <div className="flex flex-col h-full w-full border border-thepurple/10 rounded-2xl bg-white shadow-ombre">
            <div className="flex items-center justify-between mt-5 px-5">
                <div className="font-sf text-2xl font-bold text-black/75">Filtres</div>
                {onClose && (
                    <button onClick={onClose} className="text-black/40 hover:text-thepurple transition-colors" aria-label="Fermer les filtres">
                        <FiX className="h-5 w-5" />
                    </button>
                )}
            </div>
            <form onSubmit={onSubmit} className="flex flex-col gap-5 px-5 py-6">
                {hasLocationFilter && (
                    <label className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-black/60">Distance max : {draftFilters.distanceKm} km</span>
                        <input
                            type="range" min={5} max={100} step={5}
                            value={draftFilters.distanceKm}
                            onChange={(event) => setDraftFilters((f) => ({ ...f, distanceKm: Number(event.target.value) }))}
                            style={{ background: `linear-gradient(to right, var(--starz-color-primary) 0%, var(--starz-color-primary) ${distanceFillPercent}%, rgba(111,45,189,0.15) ${distanceFillPercent}%, rgba(111,45,189,0.15) 100%)` }}
                            className={filterRangeClassName}
                        />
                    </label>
                )}
                <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-black/60">Type de contrat</span>
                    <select value={draftFilters.contractType} onChange={(event) => setDraftFilters((f) => ({ ...f, contractType: event.target.value }))} className={filterSelectClassName}>
                        {contractTypeOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                    </select>
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-black/60">Télétravail</span>
                    <select value={draftFilters.remotePolicy} onChange={(event) => setDraftFilters((f) => ({ ...f, remotePolicy: event.target.value }))} className={filterSelectClassName}>
                        {remotePolicyOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                    </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-black/60">Salaire min</span>
                        <input type="number" min={0} value={draftFilters.salaryMin} onChange={(event) => setDraftFilters((f) => ({ ...f, salaryMin: event.target.value }))} className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black/70 outline-none focus:border-thepurple/50" />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-black/60">Salaire max</span>
                        <input type="number" min={0} value={draftFilters.salaryMax} onChange={(event) => setDraftFilters((f) => ({ ...f, salaryMax: event.target.value }))} className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black/70 outline-none focus:border-thepurple/50" />
                    </label>
                </div>
                <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-black/60">Premium</span>
                    <select value={draftFilters.premium} onChange={(event) => setDraftFilters((f) => ({ ...f, premium: event.target.value }))} className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black/70 outline-none focus:border-thepurple/50">
                        <option value="">Toutes</option>
                        <option value="true">Premium uniquement</option>
                        <option value="false">Non premium uniquement</option>
                    </select>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black/60">
                    <input type="checkbox" checked={draftFilters.favoritesOnly} onChange={(event) => setDraftFilters((f) => ({ ...f, favoritesOnly: event.target.checked }))} className="h-4 w-4 accent-thepurple" />
                    Favoris uniquement
                </label>
                <div className="flex gap-2">
                    <button type="submit" className="flex-1 rounded-xl bg-thepurple px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity">Appliquer</button>
                    <button type="button" onClick={onReset} className="flex-1 rounded-xl border border-black/10 px-3 py-2.5 text-sm font-semibold text-black/50 hover:border-thepurple/30 transition-colors">Réinitialiser</button>
                </div>
            </form>
        </div>
    );
}

export default function Offers() {
    const searchParams = useSearchParams();
    const searchParamsKey = searchParams.toString();
    const urlLocation = getTrimmedQueryParam(new URLSearchParams(searchParamsKey), "location") ?? "";
    const [locationDraft, setLocationDraft] = useState<string | null>(null);
    const hasLocationFilter = (locationDraft ?? urlLocation).trim().length > 0;
    const [draftFilters, setDraftFilters] = useState(defaultFilterForm);
    const [appliedFilters, setAppliedFilters] = useState<OfferFilters>(() => toOfferFilters(defaultFilterForm));
    const filtersKey = JSON.stringify(appliedFilters);
    const resultKey = `${searchParamsKey}|${filtersKey}`;
    const [offersState, setOffersState] = useState<{ searchKey: string; items: iOffers[] }>({ searchKey: resultKey, items: [] });
    const [favoriteOfferIds, setFavoriteOfferIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

    const pageRef = useRef(0);
    const isLoadingRef = useRef(false);
    const hasMoreRef = useRef(true);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handleLocationDraftChange = (event: Event) => {
            setLocationDraft(String((event as CustomEvent<string>).detail ?? ""));
        };

        window.addEventListener("starz:offer-location-draft-change", handleLocationDraftChange);
        return () => window.removeEventListener("starz:offer-location-draft-change", handleLocationDraftChange);
    }, []);

    const loadOffers = useCallback(async () => {
        if (isLoadingRef.current || !hasMoreRef.current) return;
        const requestedPage = pageRef.current;
        isLoadingRef.current = true;
        setLoading(true);
        setError(null);
        try {
            const response = appliedFilters.favoritesOnly
                ? await api.get("/me/favorites", { params: { page: requestedPage, size: 20 } })
                : await api.get("/offers", { params: buildOfferSearchParams(new URLSearchParams(searchParamsKey), requestedPage, appliedFilters) });
            const data = response.data.data;
            const items = appliedFilters.favoritesOnly
                ? (data.items as FavoriteListItem[]).map(toFavoriteOffer)
                : data.items;
            setOffersState((prev) => ({
                searchKey: resultKey,
                items: requestedPage === 0 ? items : mergeUniqueOffers(prev.items, items),
            }));
            if (requestedPage + 1 >= data.pagination.totalPages) {
                hasMoreRef.current = false;
            } else {
                pageRef.current = requestedPage + 1;
            }
        } catch (err) {
            const status = (err as { response?: { status?: number } }).response?.status;
            setError(status === 401 && appliedFilters.favoritesOnly
                ? "Connectez-vous pour afficher vos favoris."
                : "Impossible de charger les offres. Vérifiez que le serveur est démarré.");
        } finally {
            isLoadingRef.current = false;
            setLoading(false);
        }
    }, [appliedFilters, resultKey, searchParamsKey]);

    useEffect(() => {
        pageRef.current = 0;
        hasMoreRef.current = true;
        isLoadingRef.current = false;
        loadOffers();
    }, [filtersKey, loadOffers, searchParamsKey]);

    useEffect(() => {
        api.get("/me/favorites", { params: { page: 0, size: 100 } })
            .then((response) => {
                const favorites = response.data.data.items as FavoriteListItem[];
                setFavoriteOfferIds(new Set(favorites.map((f) => f.offer.id)));
            })
            .catch(() => setFavoriteOfferIds(new Set()));
    }, []);

    const visibleOffers = offersState.searchKey === resultKey ? offersState.items : [];
    const distanceFillPercent = ((draftFilters.distanceKm - 5) / 95) * 100;

    const handleFilterSubmit = (event: FilterSubmitEvent) => {
        event.preventDefault();
        setAppliedFilters(toOfferFilters(draftFilters));
        setMobileFiltersOpen(false);
    };

    const handleFilterReset = () => {
        setDraftFilters(defaultFilterForm);
        setAppliedFilters(toOfferFilters(defaultFilterForm));
        setMobileFiltersOpen(false);
    };

    useEffect(() => {
        if (!loadMoreRef.current) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadOffers();
                }
            },
            {
                root: null,
                rootMargin: "200px",
                threshold: 0,
            }
        );
        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [loadOffers]);

    const filterPanelProps = {
        draftFilters,
        setDraftFilters,
        hasLocationFilter,
        distanceFillPercent,
        onSubmit: handleFilterSubmit,
        onReset: handleFilterReset,
    };

    return (
        <div className="flex items-start justify-center px-4 sm:px-6">
            <div className="flex items-start justify-center w-full max-w-6xl gap-5">
                <div className="flex flex-1 flex-col items-start w-full gap-2 min-w-0">
                    <div className="flex w-full items-center justify-between md:hidden mb-2">
                        <p className="text-sm text-black/45">{visibleOffers.length > 0 ? `${visibleOffers.length} offre${visibleOffers.length > 1 ? "s" : ""}` : ""}</p>
                        <button
                            onClick={() => setMobileFiltersOpen(true)}
                            className="flex items-center gap-2 rounded-xl border border-thepurple/20 bg-white px-4 py-2 text-sm font-semibold text-thepurple shadow-sm"
                        >
                            <FiFilter className="h-4 w-4" />
                            Filtres
                        </button>
                    </div>

                    {visibleOffers.map((offer) => (
                        <Cardoffer key={offer.id} offer={offer} isFavorite={favoriteOfferIds.has(offer.id)} />
                    ))}
                    {loading && <div className="w-full flex justify-center py-6 text-black/40 text-sm">Chargement…</div>}
                    {error && <div className="w-full flex justify-center py-6 text-red-400 text-sm">{error}</div>}
                    {!loading && !error && visibleOffers.length === 0 && (
                        <div className="w-full flex justify-center py-12 text-black/40 text-sm">Aucune offre trouvée.</div>
                    )}
                    <div ref={loadMoreRef} className="w-full h-10" />
                </div>

                <div className="hidden md:flex flex-col w-72 shrink-0 sticky top-6 self-start">
                    <FilterPanel {...filterPanelProps} />
                </div>
            </div>

            {mobileFiltersOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
                    <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl">
                        <div className="sticky top-0 flex items-center justify-center pt-3 pb-1 bg-white rounded-t-3xl">
                            <div className="w-10 h-1 rounded-full bg-black/20" />
                        </div>
                        <form onSubmit={handleFilterSubmit} className="flex flex-col gap-5 px-5 py-6">
                            {hasLocationFilter && (
                                <label className="flex flex-col gap-2">
                                    <span className="text-sm font-semibold text-black/60">
                                        Distance max : {draftFilters.distanceKm} km
                                    </span>
                                    <input
                                        type="range"
                                        min={5}
                                        max={100}
                                        step={5}
                                        value={draftFilters.distanceKm}
                                        onChange={(event) => setDraftFilters((filters) => ({
                                            ...filters,
                                            distanceKm: Number(event.target.value),
                                        }))}
                                        style={{
                                            background: `linear-gradient(to right, var(--starz-color-primary) 0%, var(--starz-color-primary) ${distanceFillPercent}%, rgba(111,45,189,0.15) ${distanceFillPercent}%, rgba(111,45,189,0.15) 100%)`,
                                        }}
                                        className={filterRangeClassName}
                                    />
                                </label>
                            )}

                            <label className="flex flex-col gap-1.5">
                                <span className="text-sm font-semibold text-black/60">Type de contrat</span>
                                <select
                                    value={draftFilters.contractType}
                                    onChange={(event) => setDraftFilters((filters) => ({
                                        ...filters,
                                        contractType: event.target.value,
                                    }))}
                                    className={filterSelectClassName}
                                >
                                    {contractTypeOptions.map((option) => (
                                        <option key={option.label} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="flex flex-col gap-1.5">
                                <span className="text-sm font-semibold text-black/60">Télétravail</span>
                                <select
                                    value={draftFilters.remotePolicy}
                                    onChange={(event) => setDraftFilters((filters) => ({
                                        ...filters,
                                        remotePolicy: event.target.value,
                                    }))}
                                    className={filterSelectClassName}
                                >
                                    {remotePolicyOptions.map((option) => (
                                        <option key={option.label} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="grid grid-cols-2 gap-2">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-sm font-semibold text-black/60">Salaire min</span>
                                    <input
                                        type="number"
                                        min={0}
                                        value={draftFilters.salaryMin}
                                        onChange={(event) => setDraftFilters((filters) => ({
                                            ...filters,
                                            salaryMin: event.target.value,
                                        }))}
                                        className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black/70 outline-none focus:border-thepurple/50"
                                    />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-sm font-semibold text-black/60">Salaire max</span>
                                    <input
                                        type="number"
                                        min={0}
                                        value={draftFilters.salaryMax}
                                        onChange={(event) => setDraftFilters((filters) => ({
                                            ...filters,
                                            salaryMax: event.target.value,
                                        }))}
                                        className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black/70 outline-none focus:border-thepurple/50"
                                    />
                                </label>
                            </div>

                            <label className="flex flex-col gap-1.5">
                                <span className="text-sm font-semibold text-black/60">Premium</span>
                                <select
                                    value={draftFilters.premium}
                                    onChange={(event) => setDraftFilters((filters) => ({
                                        ...filters,
                                        premium: event.target.value,
                                    }))}
                                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm text-black/70 outline-none focus:border-thepurple/50"
                                >
                                    <option value="">Toutes</option>
                                    <option value="true">Premium uniquement</option>
                                    <option value="false">Non premium uniquement</option>
                                </select>
                            </label>

                            <label className="flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-black/60">
                                <input
                                    type="checkbox"
                                    checked={draftFilters.favoritesOnly}
                                    onChange={(event) => setDraftFilters((filters) => ({
                                        ...filters,
                                        favoritesOnly: event.target.checked,
                                    }))}
                                    className="h-4 w-4 accent-thepurple"
                                />
                                Favoris uniquement
                            </label>

                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    className="flex-1 rounded-xl bg-thepurple px-3 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                                >
                                    Appliquer
                                </button>
                                <button
                                    type="button"
                                    onClick={handleFilterReset}
                                    className="flex-1 rounded-xl border border-black/10 px-3 py-2.5 text-sm font-semibold text-black/50 hover:border-thepurple/30 transition-colors"
                                >
                                    Réinitialiser
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
