import { beforeAll, describe, expect, it } from "vitest";
import { createTwoFactorProof, verifyTwoFactorProof } from "../lib/twoFactorProof.js";

const secret = "test-only-signing-secret-that-is-long-enough";
const userId = "user-test-123";
const now = Date.UTC(2026, 0, 1, 12, 0, 0);

beforeAll(() => {
    if (!globalThis.crypto?.subtle) {
        throw new Error("Web Crypto is required to run 2FA proof tests.");
    }
});

describe("two-factor session proofs", () => {
    it("accepts a valid proof for its user and validity window", async () => {
        const proof = await createTwoFactorProof(userId, secret, now);

        await expect(verifyTwoFactorProof(proof, userId, secret, now + 1_000)).resolves.toBe(true);
    });

    it("rejects a proof for another user", async () => {
        const proof = await createTwoFactorProof(userId, secret, now);

        await expect(verifyTwoFactorProof(proof, "another-user", secret, now + 1_000)).resolves.toBe(false);
    });

    it("rejects modified, malformed, expired, and future-issued proofs", async () => {
        const proof = await createTwoFactorProof(userId, secret, now);
        const [issuedAt, expiresAt, signature] = proof.split(".");
        const tamperedProof = `${issuedAt}.${expiresAt}.${signature.slice(0, -2)}00`;
        const futureProof = await createTwoFactorProof(userId, secret, now + 120_000);

        await expect(verifyTwoFactorProof(tamperedProof, userId, secret, now + 1_000)).resolves.toBe(false);
        await expect(verifyTwoFactorProof("bad-proof", userId, secret, now)).resolves.toBe(false);
        await expect(verifyTwoFactorProof(proof, userId, secret, now + 9 * 60 * 60 * 1000)).resolves.toBe(false);
        await expect(verifyTwoFactorProof(futureProof, userId, secret, now)).resolves.toBe(false);
    });

    it("requires a signing secret", async () => {
        await expect(createTwoFactorProof(userId, "", now)).rejects.toThrow("NEXTAUTH_SECRET is required.");
    });
});
