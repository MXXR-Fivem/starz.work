"use client";

import { useSearchParams } from "next/navigation";
import OfferSearchBar from "./offersearchbar";

export default function Search() {
    const searchParams = useSearchParams();
    const searchParamsKey = searchParams.toString();

    return (
        <OfferSearchBar
            key={searchParamsKey}
            initialQuery={searchParams.get("q") ?? ""}
            initialLocation={searchParams.get("location") ?? ""}
        />
    );
}
