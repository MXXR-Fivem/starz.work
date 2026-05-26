import { Suspense } from "react";
import Navbar from "@/components/ui/navbar";
import Offer from "@/components/ui/offers";
import Search from "@/components/ui/search";

export default function Offers() {
    return (
        <main>
            <Navbar />
            <div className="flex flex-col mt-3 gap-7 max-sm:mt-5">
                <Suspense>
                    <Search />
                    <Offer />
                </Suspense>
            </div>
        </main> 
    );
}       
