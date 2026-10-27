const { contextBridge, ipcRenderer } = require("electron");

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
