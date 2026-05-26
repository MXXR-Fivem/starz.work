const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path } = await params;
    const { search } = new URL(request.url);
    const uploadPath = path.map((segment) => encodeURIComponent(segment)).join("/");
    const upstreamResponse = await fetch(new URL(`/uploads/${uploadPath}${search}`, API_URL), {
        headers: {
            cookie: request.headers.get("cookie") ?? "",
            authorization: request.headers.get("authorization") ?? ""
        },
        cache: "no-store"
    });
    const responseHeaders = new Headers();

    for (const header of ["content-type", "content-length", "cache-control", "etag", "last-modified"]) {
        const value = upstreamResponse.headers.get(header);

        if (value) {
            responseHeaders.set(header, value);
        }
    }

    return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders
    });
}
