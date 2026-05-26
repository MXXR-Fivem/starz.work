import { type NextRequest, NextResponse } from "next/server";

const PROTECTED_ROUTES = ["/offers"];
const AUTH_ROUTES = ["/auth/login"];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const isAuthenticated = request.cookies.has("starz_session");

    if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route)) && !isAuthenticated) {
        const loginUrl = new URL("/auth/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
    }

    if (AUTH_ROUTES.some((route) => pathname.startsWith(route)) && isAuthenticated) {
        return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/offers/:path*", "/auth/login"],
};
