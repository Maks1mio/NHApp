// This file is required by the rest of the app and is included in the web page.
// It is used to expose APIs to the renderer process using contextBridge.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
  },
  dialog: {
    showOpenDialog: (options: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke("dialog:showOpenDialog", options),
  },
});

export {};
