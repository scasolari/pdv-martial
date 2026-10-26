import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import packageJson from "../../../package.json";

const operatingSystems = {
    darwin: "macOS",
    linux: "Linux",
    win32: "Windows",
};

export default function handler(req, res) {
    if (process.env.PDV_DESKTOP_APP !== "1") {
        return res.status(404).json({ error: "Not found." });
    }
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ error: "Method not allowed." });
    }

    res.setHeader("Cache-Control", "no-store");
    let sqlitePath = null;
    let sqliteFileSizeBytes = null;
    let availableDiskBytes = null;
    try {
        if (process.env.DATABASE_URL?.startsWith("file:")) {
            sqlitePath = fileURLToPath(process.env.DATABASE_URL);
            const disk = fs.statfsSync(path.dirname(sqlitePath));
            availableDiskBytes = disk.bavail * disk.bsize;
            sqliteFileSizeBytes = fs.statSync(sqlitePath).size;
        }
    } catch {
        // Keep computer details available if disk information cannot be read.
    }

    return res.status(200).json({
        operatingSystem: operatingSystems[os.platform()] || os.platform(),
        osVersion: os.release(),
        architecture: os.arch(),
        computerName: os.hostname(),
        appVersion: packageJson.version,
        availableDiskBytes,
        sqlitePath,
        sqliteFileSizeBytes,
    });
}
