import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encode } from "next-auth/jwt";
import db from "@/lib/db";
import { createTwoFactorProof } from "../lib/twoFactorProof.js";
import { requireTwoFactorApi } from "../lib/requireTwoFactorApi.js";

vi.mock("@/lib/db", () => ({ default: { user: { findUnique: vi.fn() } } }));

const secret = "test-only-next-auth-jwt-secret-long-enough";
const userId = "nextauth-integration-user";

function createResponse() {
    return {
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

async function makeRequest(token, proof) {
    return {
        headers: token ? { cookie: `next-auth.session-token=${token}` } : {},
        cookies: {
            ...(token ? { "next-auth.session-token": token } : {}),
            ...(proof ? { "2fa_session": proof } : {}),
        },
    };
}

async function makeToken(options = {}) {
    return encode({
        token: { id: userId, role: "user", is2FAEnabled: false },
        secret: options.secret || secret,
        ...(options.maxAge === undefined ? {} : { maxAge: options.maxAge }),
    });
}

describe("NextAuth encrypted session integration", () => {
    const previousSecret = process.env.NEXTAUTH_SECRET;
    const previousUrl = process.env.NEXTAUTH_URL;

    beforeEach(() => {
        process.env.NEXTAUTH_SECRET = secret;
        process.env.NEXTAUTH_URL = "http://localhost:3000";
        vi.clearAllMocks();
        db.user.findUnique.mockResolvedValue({ is2FAEnabled: false });
    });

    afterEach(() => {
        if (previousSecret === undefined) delete process.env.NEXTAUTH_SECRET;
        else process.env.NEXTAUTH_SECRET = previousSecret;
        if (previousUrl === undefined) delete process.env.NEXTAUTH_URL;
        else process.env.NEXTAUTH_URL = previousUrl;
    });

    it("accepts a valid encrypted NextAuth cookie and loads the current account's 2FA setting", async () => {
        const token = await makeToken();
        const response = createResponse();

        await expect(requireTwoFactorApi(await makeRequest(token), response))
            .resolves.toMatchObject({ id: userId, role: "user" });
        expect(db.user.findUnique).toHaveBeenCalledWith({
            where: { id: userId },
            select: { is2FAEnabled: true },
        });
        expect(response.statusCode).toBeUndefined();
    });

    it("rejects a tampered or wrongly signed session cookie before looking up the user", async () => {
        const validToken = await makeToken();
        const tamperedToken = `${validToken.slice(0, -2)}xx`;
        const tamperedResponse = createResponse();
        await expect(requireTwoFactorApi(await makeRequest(tamperedToken), tamperedResponse)).resolves.toBeNull();
        expect(tamperedResponse.statusCode).toBe(401);
        expect(db.user.findUnique).not.toHaveBeenCalled();

        const wrongSecretToken = await makeToken({ secret: "a-different-test-secret-that-is-long-enough" });
        const wrongSecretResponse = createResponse();
        await expect(requireTwoFactorApi(await makeRequest(wrongSecretToken), wrongSecretResponse)).resolves.toBeNull();
        expect(wrongSecretResponse.statusCode).toBe(401);
        expect(db.user.findUnique).not.toHaveBeenCalled();
    });

    it("rejects an expired encrypted session", async () => {
        const expiredToken = await makeToken({ maxAge: -60 });
        const response = createResponse();

        await expect(requireTwoFactorApi(await makeRequest(expiredToken), response)).resolves.toBeNull();
        expect(response.statusCode).toBe(401);
        expect(db.user.findUnique).not.toHaveBeenCalled();
    });

    it("requires a real user-bound 2FA proof when the database says 2FA is enabled", async () => {
        const token = await makeToken();
        db.user.findUnique.mockResolvedValue({ is2FAEnabled: true });

        const missingProofResponse = createResponse();
        await expect(requireTwoFactorApi(await makeRequest(token), missingProofResponse)).resolves.toBeNull();
        expect(missingProofResponse.statusCode).toBe(403);

        const proof = await createTwoFactorProof(userId, secret);
        const validProofResponse = createResponse();
        await expect(requireTwoFactorApi(await makeRequest(token, proof), validProofResponse))
            .resolves.toMatchObject({ id: userId });
        expect(validProofResponse.statusCode).toBeUndefined();
    });
});
