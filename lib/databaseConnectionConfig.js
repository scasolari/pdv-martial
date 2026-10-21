const ENVELOPE_PREFIX = "pdv-external-connection:v1:";

export function parseStoredConnectionConfig(value) {
    if (typeof value !== "string" || !value.startsWith(ENVELOPE_PREFIX)) {
        return { connectionString: value, ssh: null, ssl: null };
    }
    try {
        const config = JSON.parse(value.slice(ENVELOPE_PREFIX.length));
        return {
            connectionString: config.connectionString,
            ssh: config.ssh || null,
            ssl: config.ssl || null,
        };
    } catch {
        throw new Error("Saved database connection settings are invalid.");
    }
}

export function serializeConnectionConfig({ connectionString, ssh, ssl }) {
    if (!ssh && !ssl?.enabled) return connectionString;
    return `${ENVELOPE_PREFIX}${JSON.stringify({
        connectionString,
        ssh: ssh || null,
        ssl: ssl?.enabled ? ssl : null,
    })}`;
}

export function validateSshConfig(ssh) {
    if (ssh == null || ssh.enabled === false) return null;
    if (typeof ssh !== "object" || Array.isArray(ssh)) throw new Error("Invalid SSH tunnel settings.");
    const host = typeof ssh.host === "string" ? ssh.host.trim() : "";
    const username = typeof ssh.username === "string" ? ssh.username.trim() : "";
    const fingerprint = typeof ssh.hostFingerprint === "string" ? ssh.hostFingerprint.trim().replace(/^SHA256:/, "") : "";
    const authType = ssh.authType === "privateKey" ? "privateKey" : "password";
    const port = Number(ssh.port || 22);
    if (!host || host.length > 253 || !username || username.length > 128 || !Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("Enter a valid SSH host, port, and username.");
    }
    if (!/^[A-Za-z0-9+/]{20,}=?$/.test(fingerprint)) {
        throw new Error("Enter the SSH server SHA-256 host key fingerprint to verify its identity.");
    }
    if (authType === "password" && (typeof ssh.password !== "string" || !ssh.password || ssh.password.length > 2048)) {
        throw new Error("Enter the SSH password.");
    }
    if (authType === "privateKey" && (typeof ssh.privateKey !== "string" || !ssh.privateKey.includes("PRIVATE KEY") || ssh.privateKey.length > 32768)) {
        throw new Error("Enter a valid SSH private key (maximum 32 KB).");
    }
    if (ssh.passphrase != null && (typeof ssh.passphrase !== "string" || ssh.passphrase.length > 2048)) {
        throw new Error("Invalid SSH private key passphrase.");
    }
    return {
        host,
        port,
        username,
        hostFingerprint: fingerprint,
        authType,
        ...(authType === "password" ? { password: ssh.password } : { privateKey: ssh.privateKey, passphrase: ssh.passphrase || undefined }),
    };
}

export function validateSslConfig(ssl, dialect) {
    if (ssl == null || ssl.enabled === false) return null;
    if (!ssl.enabled || dialect === "sqlite") return null;
    const mode = ["require", "verify-ca", "verify-full"].includes(ssl.mode) ? ssl.mode : "verify-full";
    return { enabled: true, mode };
}
