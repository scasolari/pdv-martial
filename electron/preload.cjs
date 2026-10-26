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
