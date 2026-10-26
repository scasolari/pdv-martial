const { app, BrowserWindow, ipcMain, nativeTheme, safeStorage, utilityProcess } = require("electron");
const { spawn } = require("node:child_process");
const { createServer } = require("node:net");
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");
const { readFile, writeFile, rename, rm } = require("node:fs/promises");
const { mkdirSync } = require("node:fs");
const { randomBytes, randomUUID } = require("node:crypto");
const http = require("node:http");

let serverProcess;
let serverState = { exited: false, code: null };
let mainWindow;
let isQuitting = false;
let localApiToken;
const devMode = process.argv.includes("--dev");

// Development Electron and signed production builds can have different OS
// keychain identities. Keep their encrypted keys and local data separate.
if (devMode) {
    const devUserDataPath = join(app.getPath("appData"), "placedv-query-dev");
    mkdirSync(devUserDataPath, { recursive: true, mode: 0o700 });
    app.setPath("userData", devUserDataPath);
}

nativeTheme.themeSource = "system";
ipcMain.on("desktop:set-native-theme", (_event, theme) => {
    if (["system", "light", "dark"].includes(theme)) nativeTheme.themeSource = theme;
});
ipcMain.on("desktop:toggle-maximize", (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
});

const hasAppLock = app.requestSingleInstanceLock();
if (!hasAppLock) app.quit();
else app.on("second-instance", () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

function findPort() {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            server.close((error) => error ? reject(error) : resolve(port));
        });
    });
}

function runNode(args, env, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, {
            cwd,
            env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
            stdio: "inherit",
        });
        child.once("error", reject);
        child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Desktop startup command exited with ${code}`)));
    });
}

function waitForServer(url, child, state) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        let settled = false;
        const cleanup = () => {
            child.removeListener("error", onError);
            child.removeListener("exit", onExit);
        };
        const finish = (callback, value) => {
            if (settled) return;
            settled = true;
            cleanup();
            callback(value);
        };
        const onError = (type, location) => finish(reject, new Error(`Next.js utility process failed (${type} at ${location}).`));
        const onExit = () => {
            finish(reject, new Error(`Next.js server exited (code ${state.code}).`));
        };
        const check = () => {
            if (state.exited) return onExit();
            const request = http.get(url, (response) => {
                response.resume();
                if (response.statusCode < 500) {
                    finish(resolve);
                }
                else retry();
            });
            request.once("error", retry);
        };
        child.once("error", onError);
        child.once("exit", onExit);
        const retry = () => {
            if (settled) return;
            if (++attempts > 120) return finish(reject, new Error("Timed out while starting the local app."));
            setTimeout(check, 500);
        };
        check();
    });
}

async function loadOrCreateEncryptionKey(keyPath) {
    if (!await safeStorage.isAsyncEncryptionAvailable()) {
        throw new Error("Secure credential storage is unavailable. Unlock your operating system keychain and restart Placedv Query.");
    }
    if (process.platform === "linux" && !["gnome_libsecret", "kwallet", "kwallet5", "kwallet6"].includes(safeStorage.getSelectedStorageBackend())) {
        throw new Error("A secure Linux keyring is required to store database credentials. Configure GNOME Keyring or KWallet and restart Placedv Query.");
    }

    let key;
    let shouldReEncrypt = false;
    try {
        const stored = (await readFile(keyPath, "utf8")).trim();
        if (stored.startsWith("safe-storage:v1:")) {
            const decrypted = await safeStorage.decryptStringAsync(Buffer.from(stored.slice("safe-storage:v1:".length), "base64"));
            key = decrypted.result;
            shouldReEncrypt = decrypted.shouldReEncrypt;
        } else {
            // Migrate existing installations that used a plaintext key file.
            key = stored;
        }
        if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error("The saved encryption key is invalid.");
        if (!stored.startsWith("safe-storage:v1:") || shouldReEncrypt) await saveEncryptedKey(keyPath, key);
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
        key = randomBytes(32).toString("hex");
        await saveEncryptedKey(keyPath, key);
    }
    return key;
}

async function loadOrCreateDevEncryptionKey(keyPath) {
    try {
        const key = (await readFile(keyPath, "utf8")).trim();
        if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error("The development encryption key is invalid.");
        return key;
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }

    const key = randomBytes(32).toString("hex");
    await writeFile(keyPath, `${key}\n`, { mode: 0o600, flag: "wx" });
    return key;
}

async function saveEncryptedKey(keyPath, key) {
    const encrypted = await safeStorage.encryptStringAsync(key);
    const temporaryPath = `${keyPath}.${randomUUID()}.tmp`;
    try {
        await writeFile(temporaryPath, `safe-storage:v1:${encrypted.toString("base64")}\n`, { mode: 0o600, flag: "wx" });
        await rename(temporaryPath, keyPath);
    } catch (error) {
        await rm(temporaryPath, { force: true }).catch(() => {});
        throw error;
    }
}

async function startLocalApp() {
    const appDir = app.getAppPath();
    const port = await findPort();
    const sqlitePath = join(app.getPath("userData"), "placedv.sqlite");
    const keyPath = join(app.getPath("userData"), devMode ? "dev-encryption-key" : "encryption-key");
    const encryptionKey = devMode
        ? await loadOrCreateDevEncryptionKey(keyPath)
        : await loadOrCreateEncryptionKey(keyPath);
    localApiToken = randomBytes(32).toString("base64url");
    const env = {
        ...process.env,
        NODE_ENV: devMode ? "development" : "production",
        DATABASE_URL: pathToFileURL(sqlitePath).href,
        DATABASE_SQLITE_STORAGE_DIR: join(app.getPath("userData"), "sqlite"),
        DB_ENCRYPTION_KEY: encryptionKey,
        PDV_DESKTOP_APP: "1",
        HOSTNAME: "127.0.0.1",
        PORT: String(port),
    };

    const prismaCli = join(appDir, "node_modules/prisma/build/index.js");
    // The generated Prisma client is already packaged for production. Running
    // `prisma generate` in the installed bundle would mutate signed app files.
    if (devMode) await runNode([prismaCli, "generate"], env, appDir);
    await runNode([prismaCli, "migrate", "deploy"], env, appDir);
    await runNode([join(appDir, "scripts/desktop-bootstrap.mjs")], env, appDir);

    const nextBin = join(appDir, "node_modules/next/dist/bin/next");
    serverState = { exited: false, code: null };
    serverProcess = utilityProcess.fork(nextBin, [devMode ? "dev" : "start", "-H", "127.0.0.1", "-p", String(port)], {
        cwd: appDir,
        env: { ...env, LOCAL_API_TOKEN: localApiToken },
        stdio: "inherit",
        serviceName: "Placedv Query server",
    });
    serverProcess.once("exit", (code) => {
        serverState.exited = true;
        serverState.code = code;
        if (isQuitting) return;
        console.error(`Next.js server exited (code ${code}).`);
    });
    await waitForServer(`http://127.0.0.1:${port}/app/playground/play`, serverProcess, serverState);
    return `http://127.0.0.1:${port}`;
}

async function createWindow() {
    const url = await startLocalApp();
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 940,
        minWidth: 960,
        minHeight: 640,
        ...(process.platform === "darwin"
            ? {
                  titleBarStyle: "hiddenInset",
                  trafficLightPosition: { x: 12, y: 17 },
              }
            : {}),
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: join(app.getAppPath(), "electron/preload.cjs"),
            sandbox: true,
        },
    });
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    const localOrigin = new URL(url).origin;
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders({ urls: ["http://127.0.0.1:*/api/*"] }, (details, callback) => {
        const requestUrl = new URL(details.url);
        if (requestUrl.origin !== localOrigin || !requestUrl.pathname.startsWith("/api/")) {
            callback({ requestHeaders: details.requestHeaders });
            return;
        }
        callback({
            requestHeaders: {
                ...details.requestHeaders,
                "X-Local-App-Token": localApiToken,
            },
        });
    });
    mainWindow.webContents.on("will-navigate", (event, target) => {
        try {
            if (new URL(target).origin !== localOrigin) event.preventDefault();
        } catch {
            event.preventDefault();
        }
    });
    const appUrl = `${url}/app/playground/play`;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
        try {
            await mainWindow.loadURL(appUrl);
            return;
        } catch (error) {
            if (serverState.exited || attempt === 5) throw error;
            console.warn(`Local app connection failed; retrying (${attempt}/5).`);
            await new Promise((resolve) => setTimeout(resolve, 500));
            await waitForServer(appUrl, serverProcess, serverState);
        }
    }
}

if (hasAppLock) {
    app.whenReady().then(createWindow).catch((error) => {
        console.error("Unable to start Placedv Query desktop app", error);
        app.quit();
    });
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
    isQuitting = true;
    if (serverProcess && !serverState.exited) serverProcess.kill();
});
