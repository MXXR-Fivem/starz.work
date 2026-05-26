export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "starz_theme";
export const THEME_CHANGED_EVENT = "starz_theme_changed";

export const applyTheme = (theme: ThemeMode) => {
    if (typeof document === "undefined") {
        return;
    }

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    const themeColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--starz-color-page")
        .trim();
    const themeColorMeta = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");

    if (themeColorMeta && themeColor) {
        themeColorMeta.content = themeColor;
    }
};

export const persistTheme = (theme: ThemeMode) => {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyTheme(theme);
    window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, { detail: theme }));
};

export const readPersistedTheme = (): ThemeMode | null => {
    if (typeof window === "undefined") {
        return null;
    }

    const theme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return theme === "dark" || theme === "light" ? theme : null;
};
