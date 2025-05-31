import {
  app,
  BrowserWindow,
  protocol,
  ipcMain,
  session,
  dialog,
  powerMonitor,
} from "electron";
import { WebSocketServer } from "ws";
import axios from "axios";
import { Agent } from "https";
import { API, Tag } from "nhentai-api";
import * as fs from "fs";
import * as path from "path";
import { autoUpdater, AppUpdater } from "electron-updater";
import log from "electron-log";

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Configure logging
log.transports.file.level = "debug";
log.transports.console.level = "debug";

const TAGS_PATH = path.resolve(__dirname, "utils", "nhentai-tags.json");
let tagsDb: any = {};
try {
  tagsDb = JSON.parse(fs.readFileSync(TAGS_PATH, "utf8"));
  log.info("Tags loaded successfully, updated:", tagsDb.updated);
} catch (err) {
  log.error("Failed to load nhentai-tags.json:", err);
  tagsDb = {
    tags: [],
    artists: [],
    characters: [],
    parodies: [],
    groups: [],
    categories: [],
    languages: [],
  };
}

const nh = new API({
  agent: new Agent(),
  hosts: {
    api: "nhentai.net",
    images: "i.nhentai.net",
    thumbs: "t.nhentai.net",
  },
  ssl: true,
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

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

const baseAxiosCfg = {
  timeout: 10_000,
  headers: { "User-Agent": "nh-client" },
  httpAgent: nh.ssl ? undefined : nh.agent,
  httpsAgent: nh.ssl ? nh.agent : undefined,
} as const;

const api = axios.create({
  baseURL: `${nh.ssl ? "https" : "http"}://${nh.hosts.api}`,
  ...baseAxiosCfg,
});

axios.defaults.httpAgent = baseAxiosCfg.httpAgent;
axios.defaults.httpsAgent = baseAxiosCfg.httpsAgent;

type OrigExt =
  | "jpg.webp"
  | "jpg"
  | "png.webp"
  | "png"
  | "webp.webp"
  | "webp"
  | "gif.webp"
  | "gif";

const extByToken = (
  t: "j" | "p" | "w" | "g" | "J" | "P" | "W" | "G"
): OrigExt => {
  switch (t) {
    case "J":
      return "jpg.webp";
    case "j":
      return "jpg";
    case "P":
      return "png.webp";
    case "p":
      return "png";
    case "W":
      return "webp.webp";
    case "w":
      return "webp";
    case "G":
      return "gif.webp";
    case "g":
      return "gif";
    default:
      throw new Error(`Unknown image token: ${t}`);
  }
};

interface Book {
  id: number;
  title: {
    english: string;
    japanese: string;
    pretty: string;
  };
  uploaded: string;
  media: number;
  favorites: number;
  pagesCount: number;
  scanlator: string;
  tags: Tag[];
  cover: string;
  thumbnail: string;
  pages: {
    page: number;
    url: string;
    urlThumb: string;
  }[];
  artists?: Tag[];
  characters?: Tag[];
  parodies?: Tag[];
  groups?: Tag[];
  categories?: Tag[];
  languages?: Tag[];
  raw?: any;
}

const imageHosts = ["i1", "i2", "i3"];

function pickHost(media: number, page: number): string {
  const idx = (media + page) % imageHosts.length;
  return imageHosts[idx];
}

const parseBookData = (item: any): Book => {
  const media = item.media_id;
  const coverExt = extByToken(item.images.cover?.t || "j");
  const thumbExt = extByToken(item.images.thumbnail?.t || "j");

  const coverBase = `https://t3.nhentai.net/galleries/${media}/cover`;
  const thumbBase = `https://t3.nhentai.net/galleries/${media}/thumb`;

  const pages = Array.from({ length: item.num_pages }, (_, i) => {
    const pageNum = i + 1;
    const pageExt = extByToken(item.images.pages[i]?.t || "j");
    const host = pickHost(media, pageNum);

    const pageBase = `https://${host}.nhentai.net/galleries/${media}/${pageNum}`;
    const pageBaseThumb = `https://t1.nhentai.net/galleries/${media}/${i + 1}t`;

    return {
      page: pageNum,
      url: `${pageBase}.${pageExt}`,
      urlThumb: `${pageBaseThumb}.${pageExt}`,
    };
  });

  const tags: Tag[] = item.tags || [];
  const filterTags = (type: string) =>
    tags.filter((t: Tag) => t.type === (type as any));

  return {
    id: item.id,
    title: {
      english: item.title.english,
      japanese: item.title.japanese,
      pretty: item.title.pretty,
    },
    uploaded: item.upload_date
      ? new Date(item.upload_date * 1000).toISOString()
      : "",
    media,
    favorites: item.num_favorites,
    pagesCount: item.num_pages,
    scanlator: item.scanlator || "",
    tags,
    cover: `${coverBase}.${coverExt}`,
    thumbnail: `${thumbBase}.${thumbExt}`,
    pages,
    artists: filterTags("artist"),
    characters: filterTags("character"),
    parodies: filterTags("parody"),
    groups: filterTags("group"),
    categories: filterTags("category"),
    languages: filterTags("language"),
    raw: item,
  };
};

const getFavorites = async (ids: number[]): Promise<Book[]> => {
  const promises = ids.map((id) =>
    api
      .get(`/api/gallery/${id}`)
      .then((res) => parseBookData(res.data))
      .catch((): null => null)
  );
  return (await Promise.all(promises)).filter(Boolean) as Book[];
};

function mapSortType(type: string): string {
  switch (type) {
    case "get-popular":
      return "popular";
    case "get-popular-week":
      return "popular-week";
    case "get-popular-today":
      return "popular-today";
    case "get-popular-month":
      return "popular-month";
    default:
      return "popular";
  }
}

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
  ws.on("message", async (raw) => {
    const msg = JSON.parse(raw.toString());

    try {
      switch (msg.type) {
        case "get-favorites": {
          const { ids = [], sort = "relevance", page = 1, perPage = 25 } = msg;
          if (!Array.isArray(ids) || ids.length === 0)
            throw new Error("Ids array required");

          const all = await getFavorites(ids);

          let sorted = all;
          if (sort === "popular") {
            sorted = [...all].sort((a, b) => b.favorites - a.favorites);
          }

          const start = (page - 1) * perPage;
          const paged = sorted.slice(start, start + perPage);

          ws.send(
            JSON.stringify({
              type: "favorites-reply",
              books: paged,
              totalPages: Math.max(1, Math.ceil(sorted.length / perPage)),
              currentPage: page,
              totalItems: sorted.length,
            })
          );
          break;
        }

        case "search-books": {
          const {
            query = "",
            sort = "",
            page = 1,
            perPage = 25,
            filterTags = [],
            contentType,
          } = msg;

          const tagsPart =
            Array.isArray(filterTags) && filterTags.length
              ? filterTags
                  .map((t: any) => `${t.type.replace(/s$/, "")}:"${t.name}"`)
                  .join(" ")
              : "";
          const nhQuery = `${query.trim()} ${tagsPart}`.trim() || " ";

          const allowed = [
            "popular",
            "popular-week",
            "popular-today",
            "popular-month",
          ];
          const realSort =
            contentType === "new"
              ? "date"
              : contentType === "popular" && !allowed.includes(sort)
              ? "popular"
              : sort;

          const { data } = await api.get("/api/galleries/search", {
            params: { query: nhQuery, page, per_page: perPage, sort: realSort },
          });

          const books = data.result.map(parseBookData);
          const wsType =
            contentType === "new"
              ? "new-uploads-reply"
              : contentType === "popular"
              ? "popular-books-reply"
              : "search-results-reply";

          ws.send(
            JSON.stringify({
              type: wsType,
              books,
              totalPages: data.num_pages || 1,
              currentPage: page,
            })
          );
          break;
        }

        case "get-book": {
          const { id } = msg;
          if (!id) throw new Error("ID missing");
          const { data } = await api.get(`/api/gallery/${id}`);
          ws.send(
            JSON.stringify({ type: "book-reply", book: parseBookData(data) })
          );
          break;
        }

        case "get-tags":
          ws.send(
            JSON.stringify({
              type: "tags-reply",
              tags: tagsDb,
              updated: tagsDb.updated,
            })
          );
          break;

        default:
          throw new Error(`Unknown type: ${msg.type}`);
      }
    } catch (err: any) {
      log.error("WebSocket error:", err);
      ws.send(
        JSON.stringify({
          type: "error",
          message: err.message || "Unknown error",
        })
      );
    }
  });
});

let mainWindow: BrowserWindow | null = null;

function setupAutoUpdater(window: BrowserWindow) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Проверка обновлений при запуске
  autoUpdater.checkForUpdates().catch((err) => {
    log.error("Initial update check failed:", err);
  });

  autoUpdater.on("checking-for-update", () => {
    log.info("Checking for updates...");
    window.webContents.send("update-status", {
      status: "checking",
      message: "Checking for updates...",
    });
  });

  autoUpdater.on("update-available", (info) => {
    log.info("Update available:", info.version);
    window.webContents.send("update-status", {
      status: "available",
      message: `Update ${info.version} available! Click to download.`,
      version: info.version,
    });
  });

  autoUpdater.on("update-not-available", () => {
    log.info("No updates available.");
    window.webContents.send("update-status", {
      status: "not-available",
      message: "No updates available",
    });
  });

  autoUpdater.on("error", (err) => {
    log.error("Update error:", err);
    window.webContents.send("update-status", {
      status: "error",
      message: `Update error: ${err.message || "Unknown error"}`,
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    log.info(`Download progress: ${progress.percent}%`);
    window.webContents.send("update-progress", {
      percent: progress.percent,
      message: `Downloading: ${progress.percent.toFixed(1)}%`,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    log.info("Update downloaded:", info.version);
    window.webContents.send("update-status", {
      status: "downloaded",
      message: `Update ${info.version} downloaded. Click to install.`,
      version: info.version,
    });
  });
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data:",
          "connect-src 'self' ws://localhost:8080",
        ].join("; "),
      },
    });
  });

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    frame: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY).catch((err) => {
    log.error("Failed to load main window URL:", err);
  });

  ipcMain.on("window:minimize", () => mainWindow?.minimize());
  ipcMain.on("window:maximize", () =>
    mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize()
  );
  ipcMain.on("window:close", () => mainWindow?.close());

  setupAutoUpdater(mainWindow);

  // Модифицируем обработчик ipcMain.on("window:check-for-updates", ...)
  ipcMain.on("window:check-for-updates", () => {
    log.info("Manual update check triggered");
    autoUpdater.checkForUpdates().catch((err) => {
      log.error("Manual update check failed:", err);
      mainWindow?.webContents.send("update-status", {
        status: "error",
        message: `Update check failed: ${err.message}`,
      });
    });
  });

  // Добавляем новый обработчик для начала загрузки
  ipcMain.on("window:download-update", () => {
    log.info("Starting update download");
    autoUpdater.downloadUpdate().catch((err) => {
      log.error("Download failed:", err);
      mainWindow?.webContents.send("update-status", {
        status: "error",
        message: `Download failed: ${err.message}`,
      });
    });
  });

  // Добавляем новый обработчик для установки обновления
  ipcMain.on("window:install-update", () => {
    log.info("Quitting and installing update");
    autoUpdater.quitAndInstall();
  });
});

app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
