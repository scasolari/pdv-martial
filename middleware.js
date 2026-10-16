import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { verifyTwoFactorProof } from "@/lib/twoFactorProof";

export const config = {
    matcher: [
        "/app/:path*",
        "/api/database/:path*",
        "/api/db/:path*",
        "/api/playground/:path*",
        "/api/settings/:path*",
        "/api/user/:path*",
    ],
};

export async function middleware(req) {
    const isApiRequest = req.nextUrl.pathname.startsWith("/api/");
    const session = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!session?.id) {
        return isApiRequest
            ? NextResponse.json({ error: "Not authenticated." }, { status: 401 })
            : redirectTo(req, "/");
    }

    if (!session.is2FAEnabled) return NextResponse.next();

    const proof = req.cookies.get("2fa_session")?.value || "";
    let verified = false;
    try {
        verified = await verifyTwoFactorProof(proof, session.id, process.env.NEXTAUTH_SECRET);
    } catch {
        verified = false;
    }

    if (verified) return NextResponse.next();
    return isApiRequest
        ? NextResponse.json({ error: "Two-factor verification required." }, { status: 403 })
        : redirectTo(req, "/check/2fa");
}

function redirectTo(req, pathname) {
    const url = req.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    return NextResponse.redirect(url);
}
