import { describe, expect, it } from "vitest";
import {
    parseStoredConnectionConfig,
    serializeConnectionConfig,
    validateSshConfig,
    validateSslConfig,
} from "../lib/databaseConnectionConfig.js";

describe("database connection configuration", () => {
    it("continues to read legacy connection strings", () => {
        const connectionString = "mysql://user:password@db.example.test/app";

        expect(parseStoredConnectionConfig(connectionString)).toEqual({
            connectionString,
            ssh: null,
            ssl: null,
        });
    });

    it("round trips SSH and SSL options without changing the connection string", () => {
        const config = {
            connectionString: "postgresql://user:password@db.example.test/app",
            ssh: { enabled: true, host: "bastion.example.test" },
            ssl: { enabled: true, mode: "verify-full" },
        };

        expect(parseStoredConnectionConfig(serializeConnectionConfig(config))).toEqual(config);
    });

    it("rejects malformed saved configuration envelopes", () => {
        expect(() => parseStoredConnectionConfig("pdv-external-connection:v1:{"))
            .toThrow("Saved database connection settings are invalid.");
    });

    it("requires a verified SSH host fingerprint and valid authentication data", () => {
        expect(() => validateSshConfig({ enabled: true, host: "bastion.example.test", username: "sergio", password: "secret" }))
            .toThrow("Enter the SSH server SHA-256 host key fingerprint to verify its identity.");

        const result = validateSshConfig({
            enabled: true,
            host: " bastion.example.test ",
            port: "2222",
            username: " sergio ",
            password: "secret",
            hostFingerprint: `SHA256:${"A".repeat(43)}=`,
        });

        expect(result).toMatchObject({
            host: "bastion.example.test",
            port: 2222,
            username: "sergio",
            hostFingerprint: `${"A".repeat(43)}=`,
            authType: "password",
        });
    });

    it("requires a private key when key authentication is selected", () => {
        expect(() => validateSshConfig({
            enabled: true,
            host: "bastion.example.test",
            username: "sergio",
            authType: "privateKey",
            privateKey: "not a key",
            hostFingerprint: "A".repeat(43),
        })).toThrow("Enter a valid SSH private key (maximum 32 KB).");
    });

    it("enables strict SSL by default and ignores SSL for SQLite", () => {
        expect(validateSslConfig({ enabled: true, mode: "unknown" }, "postgres"))
            .toEqual({ enabled: true, mode: "verify-full" });
        expect(validateSslConfig({ enabled: true, mode: "verify-full" }, "sqlite")).toBeNull();
        expect(validateSslConfig({ enabled: false }, "mysql")).toBeNull();
    });
});
