import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    nextAuth: vi.fn((config) => config),
    github: vi.fn((config) => ({ id: "github", ...config })),
    prismaAdapter: vi.fn(() => ({ name: "test-adapter" })),
    getToken: vi.fn(),
    verifyTwoFactorProof: vi.fn(),
}));

vi.mock("next-auth", () => ({ default: mocks.nextAuth }));
vi.mock("next-auth/providers/github", () => ({ default: mocks.github }));
vi.mock("@next-auth/prisma-adapter", () => ({ PrismaAdapter: mocks.prismaAdapter }));
vi.mock("@prisma/client", () => ({ PrismaClient: class PrismaClient {} }));
vi.mock("next-auth/jwt", () => ({ getToken: mocks.getToken }));
vi.mock("@/lib/twoFactorProof", () => ({ verifyTwoFactorProof: mocks.verifyTwoFactorProof }));

describe("NextAuth configuration and request guards", () => {
    let config;
    const previousAuthEnv = {
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
        GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
        GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    };

    beforeEach(async () => {
        vi.resetModules();
        process.env.NEXTAUTH_SECRET = "test-only-secret";
        process.env.GITHUB_CLIENT_ID = "test-client-id";
        process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
        config = await import("../pages/api/auth/[...nextauth].js");
        config = config.default;
    });

    afterEach(() => {
        for (const [name, value] of Object.entries(previousAuthEnv)) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
        vi.clearAllMocks();
    });

    it("uses JWT sessions and configures GitHub with the server-side credentials", () => {
        expect(config.session.strategy).toBe("jwt");
        expect(config.secret).toBe("test-only-secret");
        expect(config.providers).toHaveLength(1);
        expect(mocks.github).toHaveBeenCalledWith(expect.objectContaining({
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
            issuer: "https://github.com/login/oauth",
        }));
        expect(mocks.prismaAdapter).toHaveBeenCalled();
    });

    it("copies only intended identity and 2FA fields into JWT and client session", async () => {
        const token = await config.callbacks.jwt({
            token: { sub: "provider-subject" },
            user: {
                id: "user-1",
                role: "user",
                is2FAEnabled: true,
                is2FAActive: true,
                passwordHash: "must-not-be-copied",
                totpSecret: "must-not-be-copied",
            },
            account: { provider: "github" },
        });

        expect(token).toMatchObject({
            sub: "provider-subject",
            id: "user-1",
            role: "user",
            provider: "github",
            is2FAEnabled: true,
            is2FAActive: true,
        });
        expect(token).not.toHaveProperty("passwordHash");
        expect(token).not.toHaveProperty("totpSecret");

        const session = await config.callbacks.session({
            session: { user: { name: "User", email: "user@example.test" } },
            token,
        });
        expect(session.user).toEqual({
            name: "User",
            email: "user@example.test",
            id: "user-1",
            role: "user",
            provider: "github",
            is2FAEnabled: true,
            is2FAActive: true,
        });
        expect(await config.callbacks.jwt({ token, user: null, account: null })).toBe(token);
        expect(await config.callbacks.session({ session: {}, token })).toEqual({});
    });

    it("fails closed in the proxy for missing identity and unverified 2FA", async () => {
        const { proxy } = await import("../proxy.js");
        const apiRequest = {
            nextUrl: { pathname: "/api/playground/query", clone: () => ({ pathname: "", search: "" }) },
            cookies: { get: () => undefined },
        };

        mocks.getToken.mockResolvedValueOnce(null);
        await expect(proxy(apiRequest)).resolves.toMatchObject({ status: 401 });

        mocks.getToken.mockResolvedValueOnce({ id: "user-1", is2FAEnabled: true });
        mocks.verifyTwoFactorProof.mockResolvedValueOnce(false);
        await expect(proxy(apiRequest)).resolves.toMatchObject({ status: 403 });
        expect(mocks.verifyTwoFactorProof).toHaveBeenCalledWith("", "user-1", "test-only-secret");
    });

    it("allows a valid 2FA proof and does not require a proof when 2FA is disabled", async () => {
        const { proxy } = await import("../proxy.js");
        const request = {
            nextUrl: { pathname: "/app/playground/play", clone: () => ({ pathname: "", search: "" }) },
            cookies: { get: () => ({ value: "valid-proof" }) },
        };

        mocks.getToken.mockResolvedValueOnce({ id: "user-1", is2FAEnabled: true });
        mocks.verifyTwoFactorProof.mockResolvedValueOnce(true);
        await expect(proxy(request)).resolves.toMatchObject({ status: 200 });

        mocks.getToken.mockResolvedValueOnce({ id: "user-1", is2FAEnabled: false });
        await expect(proxy(request)).resolves.toMatchObject({ status: 200 });
    });
});
