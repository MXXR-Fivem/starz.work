const COOKIE_NAME = "starz_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
export const SESSION_CHANGED_EVENT = "starz_session_changed";

const notifySessionChanged = () => {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
};

export const hasSessionCookie = () => {
    if (typeof document === "undefined") {
        return false;
    }

    return document.cookie.split("; ").some((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));
};

export const setSessionCookie = () => {
    if (typeof document === "undefined") {
        return;
    }

    document.cookie = `${COOKIE_NAME}=1; path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
    notifySessionChanged();
};

export const clearSessionCookie = () => {
    if (typeof document === "undefined") {
        return;
    }

    document.cookie = `${COOKIE_NAME}=; path=/; SameSite=Lax; Max-Age=0`;
    notifySessionChanged();
};
