import "../styles/globals.css";
import Background from "@/components/ui/background";
import ThemeProvider from "@/components/theme/theme-provider";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
    title: "Starz",
    description: "Starz aide les jeunes talents tech à trouver des offres, gérer leurs candidatures et construire un profil professionnel en un seul endroit.",
    robots: {
        index: true,
        follow: true,
    },
};

export const viewport: Viewport = {
    themeColor: "#F5F3FF",
};

const themeInitScript = `
(() => {
    try {
        const theme = window.localStorage.getItem("starz_theme");
        if (theme === "dark" || theme === "light") {
            document.documentElement.dataset.theme = theme;
            document.documentElement.style.colorScheme = theme;
        }
    } catch (_) {}
})();
`;

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="fr" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
            </head>
            <body className="bg-page overflow-x-hidden">
                <ThemeProvider />
                <Background/>
                <div className="relative z-10">
                    {children}
                </div>
            </body>
        </html>
    );
}
