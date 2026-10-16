import { lookup } from "node:dns/promises";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { randomUUID } from "node:crypto";
import { Sequelize } from "sequelize";
import db from "@/lib/db";

const CONNECT_TIMEOUT_MS = 10_000;
const POOL_ACQUIRE_TIMEOUT_MS = 12_000;
const QUERY_TIMEOUT_MS = 30_000;
const MAX_RESULT_ROWS = 1_000;
const MAX_CONCURRENT_EXTERNAL_CONNECTIONS = 5;
const MAX_DISTRIBUTED_CONNECTION_SLOTS = 32;
const DISTRIBUTED_CONNECTION_LIMIT = process.env.DATABASE_EXTERNAL_GLOBAL_LIMIT === undefined
    ? 0
    : Number(process.env.DATABASE_EXTERNAL_GLOBAL_LIMIT);
const CONNECTION_LEASE_MS = 120_000;
const CONNECTION_LEASE_RENEW_MS = 30_000;
const MAX_CACHED_EXTERNAL_DATABASES = 16;
const EXTERNAL_DATABASE_CACHE_IDLE_MS = 5 * 60_000;
const connectionSlotState = globalThis.__pdvExternalDatabaseSlots || { active: 0 };
globalThis.__pdvExternalDatabaseSlots = connectionSlotState;
const externalSequelizeCache = globalThis.__pdvExternalSequelizeCache || {
    entries: new Map(),
    pending: new Map(),
    instances: new WeakMap(),
};
globalThis.__pdvExternalSequelizeCache = externalSequelizeCache;

function findMainSqlKeyword(statement) {
    let depth = 0;
    let quote = null;
    for (let index = 0; index < statement.length; index += 1) {
        const char = statement[index];
        if (quote) {
            if (char === "\\") index += 1;
            else if (char === quote && statement[index + 1] === quote) index += 1;
            else if (char === quote) quote = null;
            continue;
        }
        if (char === "'" || char === '"' || char === "`") {
            quote = char;
            continue;
        }
        if (char === "/" && statement[index + 1] === "*") {
            const close = statement.indexOf("*/", index + 2);
            index = close < 0 ? statement.length : close + 1;
            continue;
        }
        if (char === "-" && statement[index + 1] === "-") {
            const newline = statement.indexOf("\n", index + 2);
            index = newline < 0 ? statement.length : newline;
            continue;
        }
        if (char === "#") {
            const newline = statement.indexOf("\n", index + 1);
            index = newline < 0 ? statement.length : newline;
            continue;
        }
        if (char === "(") { depth += 1; continue; }
        if (char === ")") { depth = Math.max(0, depth - 1); continue; }
        if (depth === 0 && /[A-Za-z_]/.test(char)) {
            const match = /^[A-Za-z_]+/.exec(statement.slice(index));
            const keyword = match?.[0]?.toUpperCase();
            if (["SELECT", "INSERT", "UPDATE", "DELETE", "REPLACE"].includes(keyword)) return keyword;
            index += (match?.[0]?.length || 1) - 1;
        }
    }
    return null;
}

function capSimpleSelect(sql) {
    const statement = String(sql || "").trim();
    const hasSelectMainStatement = findMainSqlKeyword(statement) === "SELECT";
    if (!hasSelectMainStatement ||
        /\bFOR\s+UPDATE\b|\bLOCK\s+IN\s+SHARE\s+MODE\b|\bINTO\s+(?:OUTFILE|DUMPFILE)\b/i.test(statement) ||
        /;\s*\S/.test(statement) || /(?:--[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)\s*$/.test(statement)) {
        return sql;
    }
    const existingLimit = /\bLIMIT\s+(?:(\d+)\s*,\s*(\d+)|(\d+)(\s+OFFSET\s+\d+)?)\s*;?$/i.exec(statement);
    if (existingLimit) {
        const countText = existingLimit[2] || existingLimit[3];
        const count = Number(countText);
        if (count <= MAX_RESULT_ROWS + 1) return sql;
        const countOffset = existingLimit[2]
            ? existingLimit.index + existingLimit[0].lastIndexOf(countText)
            : existingLimit.index + existingLimit[0].indexOf(countText);
        return `${statement.slice(0, countOffset)}${MAX_RESULT_ROWS + 1}${statement.slice(countOffset + countText.length)}`;
    }
    if (/\bLIMIT\b/i.test(statement)) return sql;
    const hasTerminatingSemicolon = /;\s*$/.test(statement);
    const body = statement.replace(/;\s*$/, "");
    return `${body} LIMIT ${MAX_RESULT_ROWS + 1}${hasTerminatingSemicolon ? ";" : ""}`;
}

function addSelectExecutionTimeHint(sql) {
    const statement = String(sql || "");
    if (/\bMAX_EXECUTION_TIME\s*\(/i.test(statement)) return sql;
    const leadingComments = /^(\s*(?:(?:--[^\n]*(?:\n|$)|#[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)\s*)*)/;
    const [, prefix = ""] = leadingComments.exec(statement) || [];
    const query = statement.slice(prefix.length);
    if (!/^SELECT\b/i.test(query)) return sql;
    const optimizerHint = /^(SELECT\s*\/\*\+)([\s\S]*?)(\*\/)/i;
    if (optimizerHint.test(query)) {
        return `${prefix}${query.replace(optimizerHint, `$1 MAX_EXECUTION_TIME(${QUERY_TIMEOUT_MS}) $2$3`)}`;
    }
    return `${prefix}${query.replace(/^(SELECT\b)/i, `$1 /*+ MAX_EXECUTION_TIME(${QUERY_TIMEOUT_MS}) */`)}`;
}

export async function acquireExternalConnectionSlot() {
    if (!Number.isInteger(DISTRIBUTED_CONNECTION_LIMIT) || DISTRIBUTED_CONNECTION_LIMIT < 0 || DISTRIBUTED_CONNECTION_LIMIT > MAX_DISTRIBUTED_CONNECTION_SLOTS) {
        throw new Error(`DATABASE_EXTERNAL_GLOBAL_LIMIT must be 0 or between 1 and ${MAX_DISTRIBUTED_CONNECTION_SLOTS}.`);
    }
    if (connectionSlotState.active >= MAX_CONCURRENT_EXTERNAL_CONNECTIONS) {
        const error = new Error("Too many database operations are running. Try again shortly.");
        error.statusCode = 429;
        throw error;
    }
    connectionSlotState.active += 1;
    let leaseToken = null;
    if (Number.isInteger(DISTRIBUTED_CONNECTION_LIMIT) && DISTRIBUTED_CONNECTION_LIMIT > 0) {
        if (DISTRIBUTED_CONNECTION_LIMIT > MAX_DISTRIBUTED_CONNECTION_SLOTS) {
            connectionSlotState.active = Math.max(0, connectionSlotState.active - 1);
            throw new Error(`DATABASE_EXTERNAL_GLOBAL_LIMIT must be between 1 and ${MAX_DISTRIBUTED_CONNECTION_SLOTS}.`);
        }
        leaseToken = randomUUID();
        try {
            const expiresAt = new Date(Date.now() + CONNECTION_LEASE_MS);
            const claimed = await db.$executeRaw`
                UPDATE ExternalConnectionLease
                SET lease_token = ${leaseToken}, expires_at = ${expiresAt}
                WHERE slot_id <= ${DISTRIBUTED_CONNECTION_LIMIT}
                  AND (lease_token IS NULL OR expires_at <= CURRENT_TIMESTAMP(3))
                ORDER BY slot_id ASC
                LIMIT 1
            `;
            if (claimed !== 1) {
                const error = new Error("Too many database operations are running. Try again shortly.");
                error.statusCode = 429;
                throw error;
            }
        } catch (error) {
            connectionSlotState.active = Math.max(0, connectionSlotState.active - 1);
            if (!error.statusCode) error.statusCode = 503;
            throw error;
        }
    }
    let released = false;
    let renewalTimer;
    if (leaseToken) {
        renewalTimer = setInterval(() => {
            db.$executeRaw`
                UPDATE ExternalConnectionLease
                SET expires_at = ${new Date(Date.now() + CONNECTION_LEASE_MS)}
                WHERE lease_token = ${leaseToken}
            `.catch((error) => console.error("Could not renew external database lease", error?.code || "LEASE_RENEW_FAILED"));
        }, CONNECTION_LEASE_RENEW_MS);
        renewalTimer.unref?.();
    }
    return async () => {
        if (released) return;
        released = true;
        if (renewalTimer) clearInterval(renewalTimer);
        if (leaseToken) {
            try {
                await db.$executeRaw`
                    UPDATE ExternalConnectionLease SET lease_token = NULL, expires_at = NULL
                    WHERE lease_token = ${leaseToken}
                `;
            } catch (error) {
                console.error("Could not release external database lease", error?.code || "LEASE_RELEASE_FAILED");
            }
        }
        connectionSlotState.active = Math.max(0, connectionSlotState.active - 1);
    };
}

function ipv4ToNumber(address) {
    return address.split(".").reduce((value, octet) => ((value << 8) | Number(octet)) >>> 0, 0);
}

function inIpv4Range(address, network, prefix) {
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (ipv4ToNumber(address) & mask) === (ipv4ToNumber(network) & mask);
}

function isPublicAddress(address) {
    const version = isIP(address);
    if (version === 4) {
        const blocked = [
            ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
            ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
            ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
            ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
        ];
        return !blocked.some(([network, prefix]) => inIpv4Range(address, network, prefix));
    }

    if (version === 6) {
        const normalized = address.toLowerCase();
        // Permit global unicast only; block documentation, transition, and special-use ranges.
        const secondGroup = normalized.startsWith("2001:") ? Number.parseInt(normalized.split(":")[1] || "0", 16) : Number.MAX_SAFE_INTEGER;
        return /^[23][0-9a-f]{3}:/.test(normalized)
            && !normalized.startsWith("2001:db8:")
            && !(normalized.startsWith("2001:") && secondGroup <= 0x01ff)
            && !normalized.startsWith("2002:")
            && !normalized.startsWith("3fff:");
    }

    return false;
}

function privateHostIsAllowed(host) {
    const allowedHosts = (process.env.DATABASE_PRIVATE_HOST_ALLOWLIST || "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
    return allowedHosts.includes(host.toLowerCase());
}

function lookupWithTimeout(host) {
    let timer;
    return Promise.race([
        lookup(host, { all: true, verbatim: true }),
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error("DNS lookup timed out")), 5_000);
        }),
    ]).finally(() => clearTimeout(timer));
}

export async function validateExternalDatabaseUrl(connectionString) {
    if (typeof connectionString !== "string" || connectionString.length > 4096) {
        throw new Error("Invalid connection string.");
    }

    let url;
    try {
        url = new URL(connectionString);
    } catch {
        throw new Error("Invalid connection string.");
    }

    if (!["mysql:", "mysql2:"].includes(url.protocol) || !url.hostname) {
        throw new Error("Only MySQL connection strings are supported.");
    }

    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    const allowPrivate = process.env.NODE_ENV !== "production" || privateHostIsAllowed(host);
    let addresses;
    try {
        if (isIP(host)) {
            addresses = [{ address: host }];
        } else {
            addresses = await lookupWithTimeout(host);
        }
    } catch {
        throw new Error("Database host could not be resolved.");
    }

    if (!addresses.length || (!allowPrivate && addresses.some(({ address }) => !isPublicAddress(address)))) {
        throw new Error("Database host resolves to a private or reserved network. Configure an explicit private-host allowlist entry if needed.");
    }

    return { url, host, addresses, allowPrivate };
}

function closeCachedEntry(entry) {
    if (entry.closed) return;
    entry.closed = true;
    if (externalSequelizeCache.entries.get(entry.key) === entry) {
        externalSequelizeCache.entries.delete(entry.key);
    }
    externalSequelizeCache.instances.delete(entry.sequelize);
    entry.sequelize.close().catch(() => {});
}

function pruneExternalSequelizeCache(now = Date.now()) {
    for (const entry of externalSequelizeCache.entries.values()) {
        if (entry.active === 0 && now - entry.lastUsed >= EXTERNAL_DATABASE_CACHE_IDLE_MS) {
            closeCachedEntry(entry);
        }
    }
}

function makeExternalSequelize({ url, host, addresses, allowPrivate }) {
    const connectHost = process.env.NODE_ENV === "production" && !allowPrivate
        ? addresses[0].address
        : host;
    const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

    return new Sequelize(database || undefined, decodeURIComponent(url.username), decodeURIComponent(url.password), {
        dialect: "mysql",
        host: connectHost,
        port: url.port ? Number(url.port) : 3306,
        logging: false,
        pool: { max: 2, min: 0, acquire: POOL_ACQUIRE_TIMEOUT_MS, idle: 60_000, evict: 15_000 },
        dialectOptions: {
            connectTimeout: CONNECT_TIMEOUT_MS,
            ...(process.env.NODE_ENV === "production"
                ? {
                    ssl: {
                        rejectUnauthorized: true,
                        servername: host,
                        ...(process.env.DATABASE_SSL_CA_PEM ? { ca: process.env.DATABASE_SSL_CA_PEM } : {}),
                    },
                }
                : {}),
        },
    });
}

export async function acquireExternalSequelize(connectionString) {
    // Revalidate DNS and the destination on every request before reusing a warm pool.
    const validatedConnection = await validateExternalDatabaseUrl(connectionString);
    const key = createHash("sha256").update(connectionString).digest("hex");
    pruneExternalSequelizeCache();

    let entry = externalSequelizeCache.entries.get(key);
    if (entry && !entry.closed && !entry.invalidated) {
        entry.active += 1;
        entry.lastUsed = Date.now();
        return entry.sequelize;
    }

    let pending = externalSequelizeCache.pending.get(key);
    if (!pending) {
        pending = Promise.resolve().then(() => {
            while (externalSequelizeCache.entries.size >= MAX_CACHED_EXTERNAL_DATABASES) {
                const oldestIdle = [...externalSequelizeCache.entries.values()]
                    .filter((candidate) => candidate.active === 0)
                    .sort((left, right) => left.lastUsed - right.lastUsed)[0];
                if (!oldestIdle) break;
                closeCachedEntry(oldestIdle);
            }

            const cached = externalSequelizeCache.entries.size < MAX_CACHED_EXTERNAL_DATABASES;
            const sequelize = makeExternalSequelize(validatedConnection);
            entry = {
                key,
                sequelize,
                active: 0,
                lastUsed: Date.now(),
                cached,
                invalidated: false,
                closed: false,
            };
            externalSequelizeCache.instances.set(sequelize, entry);
            if (cached) externalSequelizeCache.entries.set(key, entry);
            return entry;
        }).finally(() => {
            if (externalSequelizeCache.pending.get(key) === pending) externalSequelizeCache.pending.delete(key);
        });
        externalSequelizeCache.pending.set(key, pending);
    }

    entry = await pending;
    if (entry.closed || entry.invalidated) {
        return acquireExternalSequelize(connectionString);
    }
    entry.active += 1;
    entry.lastUsed = Date.now();
    return entry.sequelize;
}

export function releaseExternalSequelize(sequelize) {
    const entry = externalSequelizeCache.instances.get(sequelize);
    if (!entry) {
        sequelize?.close().catch(() => {});
        return;
    }
    entry.active = Math.max(0, entry.active - 1);
    entry.lastUsed = Date.now();
    if (entry.active === 0 && (entry.invalidated || !entry.cached)) closeCachedEntry(entry);
}

export function invalidateExternalSequelize(connectionString) {
    if (typeof connectionString !== "string") return;
    const key = createHash("sha256").update(connectionString).digest("hex");
    const entry = externalSequelizeCache.entries.get(key);
    if (!entry) return;
    entry.invalidated = true;
    externalSequelizeCache.entries.delete(key);
    if (entry.active === 0) closeCachedEntry(entry);
}

export async function executeExternalSql(sequelize, sql) {
    const connection = await sequelize.connectionManager.getConnection({ type: "RAW", useMaster: true });
    try {
        const trimmedSql = sql.replace(/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*/, "");
        const leadingKeyword = /^(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|WITH)\b/i.exec(trimmedSql)?.[1]?.toUpperCase();
        const withMainKeyword = leadingKeyword === "WITH"
            ? findMainSqlKeyword(trimmedSql)
            : null;
        const isRowQuery = leadingKeyword !== "WITH"
            ? Boolean(leadingKeyword)
            : withMainKeyword === "SELECT";
        if (isRowQuery) {
            const boundedSql = capSimpleSelect(addSelectExecutionTimeHint(sql));
            const query = connection.query({ sql: boundedSql, timeout: QUERY_TIMEOUT_MS });
            const rows = [];
            let truncated = false;
            for await (const row of query.stream({ highWaterMark: 32 })) {
                if (rows.length < MAX_RESULT_ROWS) rows.push(row);
                else truncated = true;
            }
            return { data: rows, count: rows.length, truncated };
        }

        const result = await new Promise((resolve, reject) => {
            connection.query({ sql, timeout: QUERY_TIMEOUT_MS }, (error, queryResult) => {
                if (error) reject(error);
                else resolve(queryResult);
            });
        });
        return {
            data: [],
            count: 0,
            truncated: false,
            affectedRows: Number(result?.affectedRows || 0),
        };
    } finally {
        sequelize.connectionManager.releaseConnection(connection);
    }
}
