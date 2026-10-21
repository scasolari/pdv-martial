import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/twoFactorProof", () => ({ verifyTwoFactorProof: vi.fn() }));

import { getToken } from "next-auth/jwt";
import db from "@/lib/db";
import { verifyTwoFactorProof } from "@/lib/twoFactorProof";
import { requireTwoFactorApi } from "../lib/requireTwoFactorApi.js";

const session = { id: "user-test" };

function createResponse() {
    return {
        status: vi.fn(function status(code) { this.statusCode = code; return this; }),
        json: vi.fn(function json(body) { this.body = body; return this; }),
    };
}

describe("API authentication guard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXTAUTH_SECRET = "test-only-next-auth-secret";
        getToken.mockResolvedValue(session);
        db.user.findUnique.mockResolvedValue({ is2FAEnabled: false });
        verifyTwoFactorProof.mockResolvedValue(false);
    });

    it("returns 401 when there is no authenticated session", async () => {
        getToken.mockResolvedValue(null);
        const res = createResponse();

        await expect(requireTwoFactorApi({ headers: {}, cookies: {} }, res)).resolves.toBeNull();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.body).toEqual({ error: "Not authenticated." });
        expect(db.user.findUnique).not.toHaveBeenCalled();
    });

    it("allows an authenticated user when 2FA is not enabled", async () => {
        const req = { headers: {}, cookies: {} };
        const res = createResponse();

        await expect(requireTwoFactorApi(req, res)).resolves.toEqual(session);
        expect(verifyTwoFactorProof).not.toHaveBeenCalled();
    });

    it("denies an enabled 2FA account without a valid proof", async () => {
        db.user.findUnique.mockResolvedValue({ is2FAEnabled: true });
        const req = { headers: {}, cookies: {} };
        const res = createResponse();

        await expect(requireTwoFactorApi(req, res)).resolves.toBeNull();
        expect(verifyTwoFactorProof).toHaveBeenCalledWith("", session.id, process.env.NEXTAUTH_SECRET);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.body).toEqual({ error: "Two-factor verification required." });
    });

    it("allows an enabled 2FA account with a valid proof", async () => {
        db.user.findUnique.mockResolvedValue({ is2FAEnabled: true });
        verifyTwoFactorProof.mockResolvedValue(true);
        const req = { headers: {}, cookies: { "2fa_session": "valid-proof" } };
        const res = createResponse();

        await expect(requireTwoFactorApi(req, res)).resolves.toEqual(session);
        expect(verifyTwoFactorProof).toHaveBeenCalledWith("valid-proof", session.id, process.env.NEXTAUTH_SECRET);
        expect(res.status).not.toHaveBeenCalled();
    });

    it("returns 401 when the session user no longer exists", async () => {
        db.user.findUnique.mockResolvedValue(null);
        const res = createResponse();

        await expect(requireTwoFactorApi({ headers: {}, cookies: {} }, res)).resolves.toBeNull();
        expect(res.status).toHaveBeenCalledWith(401);
    });
});
