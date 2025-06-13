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
import { autoUpdater } from "electron-updater";
import log from "electron-log";
import { limitFetch, cachedGet } from "./utils/requestCache";

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

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

const imageHosts = ["i1", "i2", "i4"];

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

          try {
            const { data } = await api.get("/api/galleries/search", {
              params: {
                query: nhQuery,
                page: Number(page) || 1,
                per_page: Number(perPage) || 25,
                sort: realSort,
              },
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
                currentPage: Number(page) || 1,
                perPage: Number(perPage) || 25,
                totalItems: data.total || books.length,
              })
            );
          } catch (error) {
            console.error("Search error:", error);
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Failed to fetch search results",
                code: "SEARCH_ERROR",
              })
            );
          }
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

        case "get-random-book": {
          const book = await nh.getRandomBook();

          ws.send(
            JSON.stringify({
              type: "random-book-reply",
              id: book.id,
            })
          );
          break;
        }

        case "get-related-books": {
          const { id } = msg;
          if (!id) throw new Error("Book ID missing");

          const current = parseBookData(
            (await api.get(`/api/gallery/${id}`)).data
          );

          const origLangs = new Set(
            (current.languages || []).map((l) => l.name)
          );

          const toSet = <T extends { name: string }>(arr?: T[]) =>
            new Set((arr || []).map((t) => t.name));

          const meta = {
            tags: new Set(current.tags.map((t) => `${t.type}:${t.name}`)),
            artists: toSet(current.artists),
            parodies: toSet(current.parodies),
            characters: toSet(current.characters),
            groups: toSet(current.groups),
            categories: toSet(current.categories),
            languages: toSet(current.languages),
          };

          const W = {
            character: 7,
            multiCharBonus: 3,
            artist: 4,
            parody: 3,
            group: 2,
            category: 2,
            tag: 1,
            language: 0.5,
          } as const;

          const tfidf = (t: Tag) => {
            const info =
              tagsDb?.[`${t.type}s`]?.find?.((x: any) => x.id === t.id) || {};
            const total = tagsDb.totalTagUsage || 1e7;
            return Math.log((total + 1) / ((info.count ?? 1) + 1));
          };

          const characters = current.characters?.slice(0, 7) || [];
          const charQueries = characters.map((c) => `character:"${c.name}"`);
          const baseParts = [
            ...(current.artists?.map((t) => `artist:"${t.name}"`) || []),
            ...(current.parodies?.map((t) => `parody:"${t.name}"`) || []),
            ...(current.categories?.map((t) => `category:"${t.name}"`) || []),
          ];

          const fetchPages = async (q: string, pages = [1, 2, 3]) =>
            (
              await Promise.all(
                pages.map((p) =>
                  api.get("/api/galleries/search", {
                    params: {
                      query: q,
                      page: p,
                      per_page: 50,
                      sort: "popular",
                    },
                  })
                )
              )
            ).flatMap((r) => r.data.result);

          const buckets = new Map<string, any[]>();
          for (const q of charQueries) {
            const hero = q.match(/"(.+?)"/)![1];
            buckets.set(hero, await fetchPages(q));
          }

          if ([...buckets.values()].flat().length < 60) {
            const q =
              baseParts.join(" ") ||
              current.tags
                .slice(0, 10)
                .map((t) => t.name)
                .join(" ");
            buckets.set("_tags", await fetchPages(q, [1, 2, 3, 4]));
          }

          const scoredBuckets = new Map<
            string,
            { book: Book; score: number }[]
          >();

          const decay = (iso: string) =>
            Math.max(
              0.4,
              1 -
                ((Date.now() - new Date(iso).getTime()) / (30 * 24 * 3600e3)) *
                  0.1
            );

          const scoreBook = (raw: any) => {
            const b = parseBookData(raw);
            let s = 0;

            b.tags.forEach((t) => {
              if (meta.tags.has(`${t.type}:${t.name}`))
                s += (W[t.type as unknown as keyof typeof W] || 1) * tfidf(t);
            });

            const add = (arr: Tag[] | undefined, set: Set<string>, w: number) =>
              arr?.forEach((t) => {
                if (set.has(t.name)) s += w;
              });

            let matched = 0;
            b.characters?.forEach((c) => {
              if (meta.characters.has(c.name)) {
                matched++;
                s += W.character;
              }
            });
            if (matched > 1) s += matched * W.multiCharBonus;

            add(b.artists, meta.artists, W.artist);
            add(b.parodies, meta.parodies, W.parody);
            add(b.groups, meta.groups, W.group);
            add(b.categories, meta.categories, W.category);
            add(b.languages, meta.languages, W.language);

            s += b.favorites / 15000;
            s *= decay(b.uploaded);
            return { book: b, score: s };
          };

          for (const [hero, raws] of buckets) {
            const uniq = new Map(raws.map((it: any) => [it.id, it]));
            uniq.delete(id);
            const items = [...uniq.values()].map(scoreBook);
            scoredBuckets.set(
              hero,
              items.sort((a, b) => b.score - a.score)
            );
          }

          const ORDER = [...characters.map((c) => c.name), "_tags"];
          const SEEN_TITLES = new Map<
            string,
            { book: Book; langMatch: boolean }
          >();
          const result: Book[] = [];
          const MAX = 12;

          const pushIfOk = (bk: Book) => {
            const key = bk.title.pretty.trim().toLowerCase();
            const langMatch =
              bk.languages?.some((l) => origLangs.has(l.name)) || false;

            const existing = SEEN_TITLES.get(key);
            if (!existing) {
              SEEN_TITLES.set(key, { book: bk, langMatch });
              result.push(bk);
              return;
            }

            if (!existing.langMatch && langMatch) {
              SEEN_TITLES.set(key, { book: bk, langMatch });
              const idx = result.findIndex((r) => r.id === existing.book.id);
              if (idx !== -1) result[idx] = bk;
            }
          };

          let idx = 0;
          while (
            result.length < MAX &&
            ORDER.some((h) => scoredBuckets.get(h)?.length)
          ) {
            const hero = ORDER[idx % ORDER.length];
            const bucket = scoredBuckets.get(hero);
            if (bucket && bucket.length) {
              const { book } = bucket.shift()!;
              pushIfOk(book);
            }
            idx++;
          }

          ws.send(
            JSON.stringify({
              type: "related-books-reply",
              books: result.slice(0, MAX),
            })
          );
          break;
        }

        case "get-recommendations": {
          const {
            ids = [],
            sentIds = [],
            page = 0,
            perPage = 1000000000000,
            filterTags = [],
          } = msg as {
            ids: number[];
            sentIds?: number[];
            page?: number;
            perPage?: number;
            filterTags?: { id: number; type: string; name: string }[];
          };
          if (!ids.length) throw new Error("Ids array required");

          const liked = await getFavorites(ids);

          /** частотная таблица */
          const freq: Record<Bucket, Record<string, number>> = {
            character: {},
            artist: {},
            parody: {},
            group: {},
            category: {},
            tag: {},
          };

          /** известные «корзины», которые повышают вес */
          const KNOWN_BUCKETS = [
            "artist",
            "parody",
            "group",
            "category",
            "character",
          ] as const;
          type KnownBucket = (typeof KNOWN_BUCKETS)[number];

          type Bucket = KnownBucket | "tag";

          /** type-guard для bucket-ов */
          const isKnownBucket = (t: string): t is KnownBucket =>
            (KNOWN_BUCKETS as readonly string[]).includes(t);

          /** вернуть Bucket либо "tag" */
          const bucketOf = (t: Tag["type"]): Bucket =>
            isKnownBucket(t as any) ? (t as any) : "tag";

          liked.forEach((b) =>
            b.tags.forEach((t) => {
              const bkt = bucketOf(t.type);
              freq[bkt][t.name] = (freq[bkt][t.name] || 0) + 1;
            })
          );

          const filterPart =
            Array.isArray(filterTags) && filterTags.length
              ? filterTags
                  .map((t) => `${t.type.replace(/s$/, "")}:"${t.name}"`)
                  .join(" ")
              : "";

          const topN = (m: Record<string, number>, n: number): string[] =>
            Object.entries(m)
              .sort((a, b) => b[1] - a[1])
              .slice(0, n)
              .map(([k]) => k);

          const fetchPage = (q: string, p: number): Promise<any[]> =>
            cachedGet(`https://${nh.hosts.api}/api/galleries/search`, {
              query: q,
              page: p,
              per_page: perPage,
              sort: "popular",
            })
              .then((r) => r.data.result as any[])
              .catch(() => <any[]>[]);

          const topChars = topN(freq.character, 7);
          const topArts = topN(freq.artist, 5);
          const topTags = topN(freq.tag, 12);

          const favQueries: string[] = [
            ...topChars.map((c) => `character:"${c}"`),
            ...topChars
              .slice(0, 3)
              .flatMap((c, i) =>
                topArts[i] ? [`character:"${c}" artist:"${topArts[i]}"`] : []
              ),
          ];

          const tagQueries: string[] = [
            topTags.join(" "),
            ...topTags.map((t) => `"${t}"`),
          ];

          const exclude = new Set<number>(sentIds);
          const candidates = new Map<number, any>();

          const grab = async (queries: string[]): Promise<void> => {
            await Promise.all(
              [1, 2, 3].map((p) =>
                Promise.all(queries.map((q) => fetchPage(q, p)))
              )
            ).then((arr) =>
              arr.flat(2).forEach((item) => {
                if (!exclude.has(item.id) && candidates.size < perPage * 10) {
                  candidates.set(item.id, item);
                }
              })
            );
          };

          const prependFilter = (arr: string[]) =>
            filterPart ? arr.map((q) => `${filterPart} ${q}`.trim()) : arr;

          await grab(prependFilter(favQueries));
          await grab(prependFilter(tagQueries));

          const rawCandidates = Array.from(candidates.values());

          const TAG_WEIGHTS: Record<Bucket, number> = {
            character: 4,
            artist: 3,
            parody: 2,
            group: 2,
            category: 1.5,
            tag: 1,
          };

          const required = new Set(
            filterTags.map((t) => `${t.type}:${t.name}`)
          );

          const scored = rawCandidates.flatMap((raw) => {
            const b = parseBookData(raw);

            const tagKeys = new Set(b.tags.map((t) => `${t.type}:${t.name}`));
            for (const k of required) if (!tagKeys.has(k)) return [];

            let sc = b.favorites / 15_000;
            b.tags.forEach((t) => {
              const bkt = bucketOf(t.type);
              const count = freq[bkt][t.name] || 0;
              sc += TAG_WEIGHTS[bkt] * Math.pow(count, 1.3);
            });
            return [{ book: b, score: sc }];
          });

          const ordered = scored
            .sort((a, b) => b.score - a.score)
            .map((o) => o.book);

          const mildShuffle = <T>(arr: T[], top = 20): void => {
            for (let i = 0; i < Math.min(top, arr.length - 1); i++) {
              const j =
                i + Math.floor(Math.random() * (Math.min(top, arr.length) - i));
              [arr[i], arr[j]] = [arr[j], arr[i]];
            }
          };
          mildShuffle(ordered);

          const start = (page - 1) * perPage;
          ws.send(
            JSON.stringify({
              type: "recommendations-reply",
              books: ordered.slice(start, start + perPage),
              totalPages: Math.max(1, Math.ceil(ordered.length / perPage)),
              currentPage: page,
            })
          );
          break;
        }

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

  ipcMain.on("window:install-update", () => {
    log.info("Quitting and installing update");
    autoUpdater.quitAndInstall();
  });
});

app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
