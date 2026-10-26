import { NextResponse } from "next/server";
export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function hasValidLocalToken(provided, expected) {
    if (!provided || !expected || provided.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) {
        difference |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
    }
    return difference === 0;
}

export function proxy(req) {
    const host = req.headers.get("host") || "";
    const hostname = host.replace(/^\[::1\](?::\d+)?$/i, "localhost").split(":")[0].toLowerCase();
    const isApiRequest = req.nextUrl.pathname.startsWith("/api/");
    if (isApiRequest && hostname !== "localhost" && hostname !== "127.0.0.1") {
        return NextResponse.json({ error: "Local requests only." }, { status: 403 });
    }

    if (isApiRequest) {
        const origin = req.headers.get("origin");
        if (origin) {
            try {
                const originUrl = new URL(origin);
                const originHost = originUrl.hostname.toLowerCase();
                if ((originHost !== "localhost" && originHost !== "127.0.0.1" && originHost !== "::1") || originUrl.host !== host) {
                    return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
                }
            } catch {
                return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
            }
        } else if (["cross-site", "same-site"].includes(req.headers.get("sec-fetch-site") || "")) {
            return NextResponse.json({ error: "Cross-origin request denied." }, { status: 403 });
        }

        if (!hasValidLocalToken(req.headers.get("x-local-app-token"), process.env.LOCAL_API_TOKEN)) {
            return NextResponse.json({ error: "Local app token required." }, { status: 401 });
        }
    }

    const nonce = btoa(crypto.randomUUID());
    const isDev = process.env.NODE_ENV === "development";
    const csp = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval'" : ""}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
    ].join("; ");
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
}
