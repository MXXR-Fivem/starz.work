import { Suspense } from "react";
import Regcard from "@/components/ui/regcard";

export default function Register() {
    return (
        <main>
            <Suspense>
                <Regcard />
            </Suspense>
        </main>
    );
}
