import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    default: { user: { updateMany: vi.fn() } },
}));

import db from "@/lib/db";
import {
    consumeTotpStep,
    decryptTwoFactorSecret,
    encryptTwoFactorSecret,
    getVerifiedTotpStep,
    isPendingSetupExpired,
    isTwoFactorLocked,
    pendingSecretExpiry,
} from "../lib/twoFactor.js";
import { authenticator } from "@otplib/preset-default";

describe("two-factor authentication helpers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.DB_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);
        process.env.NEXTAUTH_SECRET = "test-only-next-auth-secret";
    });

    it("encrypts secrets with the versioned authenticated format and decrypts them", () => {
        const encrypted = encryptTwoFactorSecret("JBSWY3DPEHPK3PXP");

        expect(encrypted).toMatch(/^v2:enc:v2:/);
        expect(decryptTwoFactorSecret(encrypted)).toBe("JBSWY3DPEHPK3PXP");
        expect(() => decryptTwoFactorSecret(`${encrypted.slice(0, -2)}00`)).toThrow();
    });

    it("accepts only valid six-digit TOTP codes", () => {
        const secret = authenticator.generateSecret();
        const validToken = authenticator.generate(secret);

        expect(getVerifiedTotpStep(validToken, secret)).toEqual(expect.any(BigInt));
        expect(getVerifiedTotpStep("12345", secret)).toBeNull();
        expect(getVerifiedTotpStep("abcdef", secret)).toBeNull();
        expect(getVerifiedTotpStep("000000", "invalid-secret")).toBeNull();
    });

    it("checks lockout and pending setup expiry against the supplied time", () => {
        const now = Date.UTC(2026, 0, 1);

        expect(isTwoFactorLocked({ twoFALockedUntil: new Date(now + 1) }, now)).toBe(true);
        expect(isTwoFactorLocked({ twoFALockedUntil: new Date(now - 1) }, now)).toBe(false);
        expect(isPendingSetupExpired({ twoFAPendingSecret: "secret", twoFAPendingExpiresAt: new Date(now + 1) }, now)).toBe(false);
        expect(isPendingSetupExpired({ twoFAPendingSecret: "secret", twoFAPendingExpiresAt: new Date(now) }, now)).toBe(true);
        expect(pendingSecretExpiry(now)).toEqual(new Date(now + 10 * 60 * 1000));
    });

    it("consumes a TOTP step atomically so a code cannot be replayed", async () => {
        db.user.updateMany.mockResolvedValue({ count: 1 });
        const step = 12345n;

        await expect(consumeTotpStep("user-test", step, "v2:enc:v2:encrypted"))
            .resolves.toBe(true);

        const [query] = db.user.updateMany.mock.calls[0];
        expect(query.where).toEqual({
            id: "user-test",
            OR: [
                { twoFALastVerifiedStep: null },
                { twoFALastVerifiedStep: { lt: step } },
            ],
        });
        expect(query.data).toMatchObject({
            twoFASecret: "v2:enc:v2:encrypted",
            twoFALastVerifiedStep: step,
            twoFAFailedAttempts: 0,
            twoFALockedUntil: null,
        });

        db.user.updateMany.mockResolvedValue({ count: 0 });
        await expect(consumeTotpStep("user-test", step)).resolves.toBe(false);
    });
});
