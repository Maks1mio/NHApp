// This file is required by the rest of the app and is included in the web page.
// It is used to expose APIs to the renderer process using contextBridge.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
    checkForUpdates: () => ipcRenderer.send("window:check-for-updates"),
    downloadUpdate: () => ipcRenderer.send("window:download-update"),
    installUpdate: () => ipcRenderer.send("window:install-update"),
    onUpdateStatus: (callback: (event: any, status: any) => void) => {
      ipcRenderer.on("update-status", callback);
      ipcRenderer.on("update-progress", callback);
    },
  },
  dialog: {
    showOpenDialog: (options: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke("dialog:showOpenDialog", options),
  },
  booru: {
    search: (tags: string, page: number = 1) =>
      ipcRenderer.invoke("booru:search", tags, page),
    suggest: (query: string) => ipcRenderer.invoke("booru:suggest", query),
    proxy: (url: string) => ipcRenderer.invoke("booru:proxy", url),
  },
});

export {};
