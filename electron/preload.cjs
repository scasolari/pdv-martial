const { contextBridge, ipcRenderer } = require("electron");

const pendingSqliteFiles = [];
const sqliteFileListeners = new Set();
ipcRenderer.on("desktop:open-sqlite-file", (_event, file) => {
    if (!file || typeof file.path !== "string" || typeof file.name !== "string") return;
    if (sqliteFileListeners.size === 0) pendingSqliteFiles.push(file);
    else for (const listener of sqliteFileListeners) listener(file);
});

contextBridge.exposeInMainWorld("desktopTheme", {
    setTheme(theme) {
        if (["system", "light", "dark"].includes(theme)) {
            ipcRenderer.send("desktop:set-native-theme", theme);
        }
    },
});

contextBridge.exposeInMainWorld("desktopWindow", {
    toggleMaximize() {
        ipcRenderer.send("desktop:toggle-maximize");
    },
});

contextBridge.exposeInMainWorld("desktopUpdates", {
    getInfo() {
        return ipcRenderer.invoke("desktop:update-info");
    },
    checkForUpdates() {
        return ipcRenderer.invoke("desktop:update-check");
    },
    downloadUpdate() {
        return ipcRenderer.invoke("desktop:update-download");
    },
    installUpdate() {
        return ipcRenderer.invoke("desktop:update-install");
    },
    onStatus(listener) {
        if (typeof listener !== "function") return () => {};
        const handler = (_event, status) => listener(status);
        ipcRenderer.on("desktop:update-status", handler);
        return () => ipcRenderer.removeListener("desktop:update-status", handler);
    },
});

contextBridge.exposeInMainWorld("desktopFiles", {
    onOpenSqliteFile(listener) {
        if (typeof listener !== "function") return () => {};
        sqliteFileListeners.add(listener);
        while (pendingSqliteFiles.length) listener(pendingSqliteFiles.shift());
        return () => sqliteFileListeners.delete(listener);
    },
});
