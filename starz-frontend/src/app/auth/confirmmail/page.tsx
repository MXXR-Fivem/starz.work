import { Suspense } from "react";
import Confirmmail from "@/components/ui/confirmmail";

export default function Confirm() {
    return (
        <main>
            <Suspense>
                <Confirmmail />
            </Suspense>
        </main>
    );
}