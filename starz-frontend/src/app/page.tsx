import Navbar from "@/components/ui/navbar";
import Homesearch from "@/components/ui/homesearch";
import Hero from "@/components/ui/hero";
import HomeFeatures from "@/components/ui/homefeatures";

export default function Home() {
    return (
        <main>
            <Navbar />
            <main className="mt-10 max-sm:mt-5">
                <Homesearch />
                <Hero />
                <HomeFeatures />
            </main>
        </main> 
    );
}
