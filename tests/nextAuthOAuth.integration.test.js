import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import NextAuth from "next-auth";
import Github from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { createAuthOptions } from "@/lib/authOptions";

const execFileAsync = promisify(execFile);
const authSecret = "isolated-oauth-integration-secret-long-enough";
const oauthSubject = "local-oauth-user-4821";
const oauthEmail = "oauth-user@integration.invalid";

describe("NextAuth GitHub OAuth flow with local endpoints and SQLite Prisma adapter", () => {
    let tempRoot;
    let databasePath;
    let previousDatabaseUrl;
    let previousAuthUrl;
    let previousAuthSecret;
    let oauthServer;
    let providerUrl;
    let prisma;
    let authOptions;
    let authHandler;
    let sqliteClientModule;

    beforeAll(async () => {
        previousDatabaseUrl = process.env.TEST_AUTH_DATABASE_URL;
        previousAuthUrl = process.env.NEXTAUTH_URL;
        previousAuthSecret = process.env.NEXTAUTH_SECRET;
        tempRoot = await mkdtemp(path.join(os.tmpdir(), "pdv-nextauth-oauth-"));
        databasePath = path.join(tempRoot, "auth.sqlite");
        process.env.TEST_AUTH_DATABASE_URL = `file:${databasePath}`;
        process.env.NEXTAUTH_URL = "http://localhost:3000";
        process.env.NEXTAUTH_SECRET = authSecret;

        const schemaPath = path.join(process.cwd(), "prisma", "test-auth-schema.prisma");
        const prismaCliPath = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
        await execFileAsync(process.execPath, [prismaCliPath, "generate", "--schema", schemaPath], { cwd: process.cwd() });
        await execFileAsync(process.execPath, [prismaCliPath, "db", "push", "--schema", schemaPath, "--skip-generate"], {
            cwd: process.cwd(),
            env: process.env,
        });

        sqliteClientModule = await import("../generated/test-auth-client/index.js");
        prisma = new sqliteClientModule.PrismaClient();
        await prisma.$connect();

        oauthServer = createServer(async (req, res) => {
            if (req.url === "/token" && req.method === "POST") {
                let body = "";
                for await (const chunk of req) body += chunk;
                const params = new URLSearchParams(body);
                if (params.get("code") !== "test-authorization-code") {
                    res.writeHead(401, { "content-type": "application/json" });
                    res.end(JSON.stringify({ error: "invalid_grant" }));
                    return;
                }
                res.writeHead(200, { "content-type": "application/json" });
                res.end(JSON.stringify({ access_token: "local-provider-access-token", token_type: "Bearer", scope: "read:user user:email" }));
                return;
            }
            if (req.url === "/userinfo" && req.headers.authorization === "Bearer local-provider-access-token") {
                res.writeHead(200, { "content-type": "application/json" });
                res.end(JSON.stringify({ id: oauthSubject, name: "Integration User", email: oauthEmail, avatar_url: "https://example.invalid/avatar.png" }));
                return;
            }
            res.writeHead(404, { "content-type": "application/json" });
            res.end(JSON.stringify({ error: "not_found" }));
        });
        await new Promise((resolve, reject) => {
            oauthServer.once("error", reject);
            oauthServer.listen(0, "127.0.0.1", resolve);
        });
        const address = oauthServer.address();
        providerUrl = `http://127.0.0.1:${address.port}`;

        const githubProvider = Github({ clientId: "test-client", clientSecret: "test-client-secret" });
        const localGithubProvider = {
            ...githubProvider,
            authorization: { ...githubProvider.authorization, url: `${providerUrl}/authorize` },
            token: `${providerUrl}/token`,
            userinfo: `${providerUrl}/userinfo`,
            checks: ["state"],
        };

        authOptions = createAuthOptions({
            adapter: PrismaAdapter(prisma),
            providers: [localGithubProvider],
            secret: authSecret,
        });
        authOptions.logger = { error() {}, warn() {}, debug() {} };
        authHandler = NextAuth(authOptions);
    }, 60_000);

    beforeEach(async () => {
        await prisma.account.deleteMany();
        await prisma.session.deleteMany();
        await prisma.user.deleteMany();
    });

    afterAll(async () => {
        await prisma?.$disconnect();
        if (oauthServer?.listening) await new Promise((resolve) => oauthServer.close(resolve));
        if (previousDatabaseUrl === undefined) delete process.env.TEST_AUTH_DATABASE_URL;
        else process.env.TEST_AUTH_DATABASE_URL = previousDatabaseUrl;
        if (previousAuthUrl === undefined) delete process.env.NEXTAUTH_URL;
        else process.env.NEXTAUTH_URL = previousAuthUrl;
        if (previousAuthSecret === undefined) delete process.env.NEXTAUTH_SECRET;
        else process.env.NEXTAUTH_SECRET = previousAuthSecret;
        await rm(tempRoot, { recursive: true, force: true });
    }, 30_000);

    async function authRequest(url, { method = "GET", cookies = {}, body } = {}) {
        const parsedUrl = new URL(url);
        const nextauth = parsedUrl.pathname.split("/").slice(3);
        const query = Object.fromEntries(parsedUrl.searchParams);
        const req = {
            method,
            query: { ...query, nextauth },
            headers: { host: parsedUrl.host, "x-forwarded-proto": parsedUrl.protocol.replace(":", "") },
            cookies,
            ...(body ? { body } : {}),
        };
        const headers = {};
        const res = {
            status(code) { this.statusCode = code; return this; },
            setHeader(name, value) { headers[name.toLowerCase()] = value; return this; },
            getHeader(name) { return headers[name.toLowerCase()]; },
            end() { this.ended = true; return this; },
            send(value) { this.body = value; return this; },
            json(value) { this.body = value; return this; },
        };
        await authHandler(req, res);
        const setCookieHeaders = headers["set-cookie"] || [];
        const cookieLines = (Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]).filter(Boolean);
        const responseCookies = Object.fromEntries(cookieLines.map((line) => {
            const pair = line.split(";", 1)[0];
            const separator = pair.indexOf("=");
            return [pair.slice(0, separator), decodeURIComponent(pair.slice(separator + 1))];
        }));
        return { status: res.statusCode, body: res.body, redirect: headers.location, cookies: responseCookies };
    }

    it("completes OAuth callback, persists the identity, issues a session cookie, and returns the session", async () => {
        const origin = "http://localhost:3000";
        const csrf = await authRequest(`${origin}/api/auth/csrf`);
        expect(csrf.status).toBe(200);
        expect(csrf.body.csrfToken).toBeTruthy();
        const signin = await authRequest(`${origin}/api/auth/signin/github`, {
            method: "POST",
            cookies: csrf.cookies,
            body: { csrfToken: csrf.body.csrfToken, callbackUrl: `${origin}/app/playground/play` },
        });
        expect(signin.redirect).toBeTruthy();

        const authorizeUrl = new URL(signin.redirect);
        expect(authorizeUrl.origin).toBe(providerUrl);
        expect(authorizeUrl.pathname).toBe("/authorize");
        const state = authorizeUrl.searchParams.get("state");
        expect(state).toBeTruthy();

        const stateCookie = Object.entries(signin.cookies).find(([name]) => name.includes("state"));
        expect(stateCookie).toBeTruthy();
        const stateCookies = { ...csrf.cookies, [stateCookie[0]]: stateCookie[1] };

        const callback = await authRequest(
            `${origin}/api/auth/callback/github?code=test-authorization-code&state=${encodeURIComponent(state)}`,
            { cookies: { ...stateCookies, ...signin.cookies } },
        );
        expect(callback.status).toBe(302);
        expect(callback.redirect).toBe(`${origin}/app/playground/play`);

        const persistedAccount = await prisma.account.findUnique({
            where: {
                provider_providerAccountId: {
                    provider: "github",
                    providerAccountId: oauthSubject,
                },
            },
            include: { user: true },
        });
        expect(persistedAccount).toMatchObject({
            type: "oauth",
            provider: "github",
            providerAccountId: oauthSubject,
            user: { email: oauthEmail, name: "Integration User" },
        });

        const sessionCookie = Object.entries(callback.cookies).find(([name]) => name.includes("session-token"));
        expect(sessionCookie?.[1]).toBeTruthy();
        const sessionResponse = await authRequest(`${origin}/api/auth/session`, {
            cookies: { [sessionCookie[0]]: sessionCookie[1] },
        });
        expect(sessionResponse.body.user).toMatchObject({
            id: persistedAccount.userId,
            email: oauthEmail,
            name: "Integration User",
            provider: "github",
            is2FAEnabled: false,
            is2FAActive: false,
        });
    });

    it("rejects an OAuth callback with a mismatched state without creating an account", async () => {
        const origin = "http://localhost:3000";
        const csrf = await authRequest(`${origin}/api/auth/csrf`);
        const signin = await authRequest(`${origin}/api/auth/signin/github`, {
            method: "POST",
            cookies: csrf.cookies,
            body: { csrfToken: csrf.body.csrfToken, callbackUrl: "http://localhost:3000/" },
        });
        const stateCookie = Object.entries(signin.cookies).find(([name]) => name.includes("state"));
        expect(stateCookie).toBeTruthy();

        const callback = await authRequest(
            `${origin}/api/auth/callback/github?code=test-authorization-code&state=wrong-state`,
            { cookies: { ...csrf.cookies, ...signin.cookies, [stateCookie[0]]: stateCookie[1] } },
        );
        expect(callback.redirect).toContain("error=");
        expect(await prisma.account.count({ where: { provider: "github" } })).toBe(0);
    });

    it("rejects a forged sign-in POST with a mismatched CSRF token", async () => {
        const origin = "http://localhost:3000";
        const csrf = await authRequest(`${origin}/api/auth/csrf`);
        const signin = await authRequest(`${origin}/api/auth/signin/github`, {
            method: "POST",
            cookies: csrf.cookies,
            body: { csrfToken: "forged-csrf-token", callbackUrl: `${origin}/` },
        });

        expect(signin.redirect).toContain("csrf=true");
        expect(signin.redirect).not.toContain(providerUrl);
        expect(await prisma.account.count({ where: { provider: "github" } })).toBe(0);
    });
});
