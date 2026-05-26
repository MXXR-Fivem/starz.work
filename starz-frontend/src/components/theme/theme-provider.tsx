"use client";

import { useEffect } from "react";
import { api } from "@/lib/axios";
import { hasSessionCookie, SESSION_CHANGED_EVENT } from "@/lib/session";
import { applyTheme, persistTheme, readPersistedTheme, THEME_CHANGED_EVENT, type ThemeMode } from "@/lib/theme";

type ProfileThemeResponse = {
    data?: {
        user?: {
            darkMode?: boolean;
        };
    };
};

const toTheme = (darkMode: boolean): ThemeMode => darkMode ? "dark" : "light";

export default function ThemeProvider() {
    useEffect(() => {
        applyTheme(readPersistedTheme() ?? "light");

        const syncTheme = () => {
            const localTheme = readPersistedTheme();

            if (localTheme) {
                applyTheme(localTheme);
            }

            if (!hasSessionCookie()) {
                return;
            }

            api.get<ProfileThemeResponse>("/me")
                .then((response) => {
                    const darkMode = response.data.data?.user?.darkMode;

                    if (typeof darkMode === "boolean") {
                        persistTheme(toTheme(darkMode));
                    }
                })
                .catch(() => undefined);
        };

        const onThemeChanged = (event: Event) => {
            const theme = (event as CustomEvent<ThemeMode>).detail;

            if (theme === "dark" || theme === "light") {
                applyTheme(theme);
            }
        };

        syncTheme();
        window.addEventListener(SESSION_CHANGED_EVENT, syncTheme);
        window.addEventListener("storage", syncTheme);
        window.addEventListener(THEME_CHANGED_EVENT, onThemeChanged);

        return () => {
            window.removeEventListener(SESSION_CHANGED_EVENT, syncTheme);
            window.removeEventListener("storage", syncTheme);
            window.removeEventListener(THEME_CHANGED_EVENT, onThemeChanged);
        };
    }, []);

    return null;
}
