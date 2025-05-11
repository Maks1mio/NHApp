import { app, BrowserWindow, protocol, ipcMain, dialog } from "electron";
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null;

app.on("ready", () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    frame: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      enableBlinkFeatures: "WebGL2",
    },
  });
  // Warning: Do not use `nodeIntegration: true` in production. It is a security risk.
  // See https://www.electronjs.org/docs/latest/tutorial/context-isolation for more information.

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY).catch(console.error);

  registerIpcHandlers();

  ipcMain.on("window:minimize", () => mainWindow?.minimize());
  ipcMain.on("window:maximize", () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on("window:close", () => mainWindow?.close());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

protocol.registerSchemesAsPrivileged([
  {
    scheme: "http",
    privileges: { standard: true, bypassCSP: true, corsEnabled: true },
  },
  {
    scheme: "https",
    privileges: { standard: true, bypassCSP: true, corsEnabled: true },
  },
]);

const registerIpcHandlers = () => {
  ipcMain.handle("dialog:showOpenDialog", async (_, options) => {
    return dialog.showOpenDialog(options);
  });
};
