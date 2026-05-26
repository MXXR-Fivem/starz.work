"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IoClose } from "react-icons/io5";
import { api } from "@/lib/axios";
import { iOffers } from "@/components/schemas/offerapi";

type OfferSearchBarProps = {
    initialQuery?: string;
    initialLocation?: string;
    showTags?: boolean;
};

type SearchSubmitEvent = {
    preventDefault: () => void;
};

type InputChangeEvent = {
    target: HTMLInputElement;
};

const tags = ["Stage", "Alternance", "CDI", "Rust", "Frontend", "C++"];

const setOptionalParam = (params: URLSearchParams, key: string, value: string) => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
        params.set(key, trimmedValue);
        return;
    }
    params.delete(key);
};

const normalizeLocation = (location: string): string =>
    location.trim().replace(/\s+/g, " ");

const extractSuggestionCities = (location: string): string[] => {
    const parts = location
        .split(",")
        .map(normalizeLocation)
        .filter(Boolean);
    if (parts.length <= 2) return parts.slice(0, 1);
    const cities: string[] = [];
    for (let index = 0; index < parts.length; index += 2) {
        cities.push(parts[index]);
    }
    return cities;
};

const getUniqueLocations = (offers: iOffers[], search: string): string[] => {
    const normalizedSearch = search.trim().toLowerCase();
    const locations = new Map<string, string>();
    for (const offer of offers) {
        const location = offer.location?.trim();
        if (!location || !location.toLowerCase().includes(normalizedSearch)) continue;
        for (const city of extractSuggestionCities(location)) {
            if (city.toLowerCase().includes(normalizedSearch)) {
                locations.set(city.toLowerCase(), city);
            }
        }
    }
    return Array.from(locations.values()).slice(0, 5);
};

const dispatchLocationDraftChange = (value: string) => {
    window.dispatchEvent(new CustomEvent("starz:offer-location-draft-change", {
        detail: value,
    }));
};

export default function OfferSearchBar({
    initialQuery = "",
    initialLocation = "",
    showTags = false,
}: OfferSearchBarProps) {
    const router = useRouter();
    const [query, setQuery] = useState(initialQuery);
    const [location, setLocation] = useState(initialLocation);
    const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
    const [areSuggestionsOpen, setAreSuggestionsOpen] = useState(false);
    const suggestionTimerRef = useRef<number | null>(null);
    const suggestionRequestIdRef = useRef(0);

    const loadLocationSuggestions = (value: string) => {
        const trimmedValue = value.trim();
        suggestionRequestIdRef.current += 1;
        const requestId = suggestionRequestIdRef.current;
        if (suggestionTimerRef.current) window.clearTimeout(suggestionTimerRef.current);
        if (trimmedValue.length < 2) {
            setLocationSuggestions([]);
            setAreSuggestionsOpen(false);
            return;
        }
        suggestionTimerRef.current = window.setTimeout(async () => {
            try {
                const response = await api.get("/offers", { params: { page: 0, size: 12, location: trimmedValue } });
                const suggestions = getUniqueLocations(response.data.data.items, trimmedValue);
                if (requestId === suggestionRequestIdRef.current) {
                    setLocationSuggestions(suggestions);
                    setAreSuggestionsOpen(suggestions.length > 0);
                }
            } catch {
                if (requestId === suggestionRequestIdRef.current) {
                    setLocationSuggestions([]);
                    setAreSuggestionsOpen(false);
                }
            }
        }, 180);
    };

    const handleLocationChange = (event: InputChangeEvent) => {
        const value = event.target.value;
        setLocation(value);
        dispatchLocationDraftChange(value);
        loadLocationSuggestions(value);
    };

    const resetQuery = () => {
        setQuery("");
    };

    const resetLocation = () => {
        setLocation("");
        dispatchLocationDraftChange("");
        setLocationSuggestions([]);
        setAreSuggestionsOpen(false);
    };

    const handleLocationFocus = () => {
        setAreSuggestionsOpen(locationSuggestions.length > 0);
    };

    const handleLocationBlur = () => {
        window.setTimeout(() => setAreSuggestionsOpen(false), 120);
    };

    const handleSuggestionSelect = (suggestion: string) => {
        setLocation(suggestion);
        dispatchLocationDraftChange(suggestion);
        setLocationSuggestions([]);
        setAreSuggestionsOpen(false);
    };

    const handleSubmit = (event: SearchSubmitEvent) => {
        event.preventDefault();
        const nextParams = new URLSearchParams();
        setOptionalParam(nextParams, "q", query);
        setOptionalParam(nextParams, "location", location);
        const queryString = nextParams.toString();
        router.push(queryString ? `/offers?${queryString}` : "/offers");
    };

    return (
        <section className="flex flex-col items-center justify-start gap-3 px-4 sm:px-8">
            {showTags && (
                <div className="flex items-center gap-2 flex-wrap justify-center sm: hidden">
                    {tags.map((tag) => (
                        <Link
                            key={tag}
                            href={`/offers?q=${encodeURIComponent(tag)}`}
                            className="text-sm px-4 py-1.5 rounded-full border border-thepurple/20 text-thepurple/70 hover:bg-thepurple/10 hover:border-thepurple/40 transition-all duration-150"
                        >
                            {tag}
                        </Link>
                    ))}
                </div>
            )}

            <form
                onSubmit={handleSubmit}
                className="relative z-40 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white rounded-2xl border border-black/10 drop-shadow-[0px_4px_4px_rgba(0,0,0,0.08)] p-2 w-full max-w-4xl"
            >
                <div className="flex items-center gap-5 flex-1 px-4 py-2.5 sm:py-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--starz-color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <div className="relative flex-1">
                        <input
                            name="q"
                            type="text"
                            autoComplete="off"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Poste, entreprise, mot-clé..."
                            className="w-full pr-7 outline-none text-base text-black/70 placeholder:text-black/30 bg-transparent"
                        />
                        {query && (
                            <button type="button" onClick={resetQuery} aria-label="Effacer la recherche" className="absolute right-0 top-1/2 -translate-y-1/2 text-thepurple/70 hover:text-thepurple transition-colors">
                                <IoClose className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="hidden sm:block w-px h-8 bg-black/10 shrink-0" />
                <div className="block sm:hidden mx-4 h-px bg-black/10" />

                <div className="relative flex items-center gap-3 flex-1 px-4 py-2.5 sm:py-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--starz-color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <div className="relative flex-1">
                        <input
                            name="location"
                            type="text"
                            autoComplete="off"
                            value={location}
                            onChange={handleLocationChange}
                            onFocus={handleLocationFocus}
                            onBlur={handleLocationBlur}
                            placeholder="Ville, département..."
                            className="w-full pr-7 outline-none text-base text-black/70 placeholder:text-black/30 bg-transparent"
                        />
                        {location && (
                            <button type="button" onClick={resetLocation} aria-label="Effacer la localisation" className="absolute right-0 top-1/2 -translate-y-1/2 text-thepurple/70 hover:text-thepurple transition-colors">
                                <IoClose className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                    {areSuggestionsOpen && (
                        <div className="absolute left-2 right-2 top-full mt-3 z-50 rounded-xl border border-black/10 bg-white shadow-ombre overflow-hidden">
                            {locationSuggestions.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => handleSuggestionSelect(suggestion)}
                                    className="w-full text-left px-4 py-2.5 text-sm text-black/65 hover:bg-thepurple/10 transition-colors"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    className="shrink-0 bg-thepurple text-white px-5 py-3 rounded-xl font-semibold text-sm hover:scale-105 transition-all duration-150 mt-0"
                >
                    Rechercher
                </button>
            </form>
        </section>
    );
}
