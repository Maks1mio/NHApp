import { app, BrowserWindow, protocol, ipcMain, session } from "electron";
import { WebSocketServer } from "ws";
import axios from "axios";
import { Agent } from "https";
import { API, Tag } from "nhentai-api";
import { APITag } from "nhentai-api/types/tag";
import * as fs from "fs";
import * as path from "path";
// import "./utils/parser";

// Импортируем локальные теги
const TAGS_PATH = path.resolve(__dirname, "utils", "nhentai-tags.json");
let tagsDb: any = {};
try {
  tagsDb = JSON.parse(fs.readFileSync(TAGS_PATH, "utf8"));
  console.log("Теги успешно загружены, обновлено:", tagsDb.updated);
} catch (err) {
  console.error("Не удалось загрузить nhentai-tags.json:", err);
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
// import "./utils/parser"

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

// Расширенный интерфейс Book с подробной структурой для передачи информации

interface Book {
  id: number;
  title: {
    english: string;
    japanese: string;
    pretty: string;
  };
  uploaded: string; // ISO string
  media: number;
  favorites: number;
  pagesCount: number;
  scanlator: string;
  tags: Tag[]; // Используем тип Tag из nhentai-api
  cover: string; // URL
  thumbnail: string; // URL
  pages: {
    page: number;
    url: string;
    urlThumb: string;
    // Можно добавить дополнительные поля, если нужно
  }[];
  // Дополнительные поля для расширенной информации
  artists?: Tag[];
  characters?: Tag[];
  parodies?: Tag[];
  groups?: Tag[];
  categories?: Tag[];
  languages?: Tag[];
  // Оригинальные данные, если нужно для отладки или расширения
  raw?: any;
}

interface PaginatedResponse {
  books: Book[];
  totalPages: number;
  currentPage: number;
}

interface WsRequest {
  type: string;
  id?: number;
  page?: number;
  query?: string;
  ids?: number[];
  sort?: string;
  perPage?: number;
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

  // Фильтрация тегов по типу
  const tags: Tag[] = item.tags || [];
  const filterTags = (type: string) => tags.filter((t: Tag) => t.type === type as any);

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
    raw: item, // для отладки
  };
};


const paginate = (total: number, perPage: number) => Math.ceil(total / perPage);

const searchBooks = async (
  query: string,
  page: number,
  sort?: string,
  perPage = 25
): Promise<PaginatedResponse> => {
  const params: any = { query, page, per_page: perPage };
  if (sort) params.sort = sort;
  const { data } = await api.get("/api/galleries/search", { params });
  const books = data.result.map(parseBookData);
  // Фикс: используем data.num_pages!
  const totalPages = data.num_pages || 1;
  return {
    books,
    totalPages,
    currentPage: page,
  };
};

const fetchBooks = async (
  type: string,
  page = 1,
  perPage = 25
): Promise<PaginatedResponse> => {
  const isPopular = type !== "new";
  let endpoint: "/api/galleries/all" | "/api/galleries/search" =
    "/api/galleries/all";
  const params: any = { page, per_page: perPage };
  if (isPopular) {
    endpoint = "/api/galleries/search";
    params.query = " ";
    params.sort = type;
  }
  const { data } = await api.get(endpoint, { params });
  const books = data.result.map(parseBookData);
  return {
    books,
    totalPages: paginate(data.num_pages, perPage),
    currentPage: page,
  };
};

const getBookById = async (id: number): Promise<Book> => {
  const { data } = await api.get(`/api/gallery/${id}`);
  return parseBookData(data);
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

wss.on("connection", ws => {
  ws.on("message", async raw => {
    const msg = JSON.parse(raw.toString());

    try {
      switch (msg.type) {

        /* ---------- избранное ----------------------------------- */
        case "get-favorites": {
          const { ids = [], sort = "relevance", page = 1, perPage = 25 } = msg;
          if (!Array.isArray(ids) || ids.length === 0)
            throw new Error("Ids array required");

          const all = await getFavorites(ids);

          /* ★ сортировка */
          let sorted = all;
          if (sort === "popular") {
            sorted = [...all].sort((a, b) => b.favorites - a.favorites);
          } // relevance = порядок в ids

          /* ★ пагинация */
          const start = (page - 1) * perPage;
          const paged = sorted.slice(start, start + perPage);

          ws.send(JSON.stringify({
            type: "favorites-reply",
            books: paged,
            totalPages: Math.max(1, Math.ceil(sorted.length / perPage)),
            currentPage: page,
            totalItems: sorted.length,           // ★
          }));
          break;
        }

        /* ---------- поиск / popular / new ------------------------ */
        case "search-books": {
          const { query = "", sort = "", page = 1, perPage = 25, filterTags = [], contentType } = msg;

          /* сборка строки запроса */
          const tagsPart = Array.isArray(filterTags) && filterTags.length
            ? filterTags.map((t: any) => `${t.type.replace(/s$/, "")}:"${t.name}"`).join(" ")
            : "";
          const nhQuery = `${query.trim()} ${tagsPart}`.trim() || " ";

          /* корректировка sort */
          const allowed = ["popular","popular-week","popular-today","popular-month"];
          const realSort =
            contentType === "new"      ? "date"   :
            contentType === "popular" && !allowed.includes(sort) ? "popular" :
            sort;

          const { data } = await api.get("/api/galleries/search", {
            params: { query: nhQuery, page, per_page: perPage, sort: realSort },
          });

          const books = data.result.map(parseBookData);
          const wsType =
            contentType === "new"     ? "new-uploads-reply"   :
            contentType === "popular" ? "popular-books-reply" : "search-results-reply";

          ws.send(JSON.stringify({
            type: wsType,
            books,
            totalPages: data.num_pages || 1,
            currentPage: page,
          }));
          break;
        }

        /* ---------- получение одной книги ----------------------- */
        case "get-book": {
          const { id } = msg;
          if (!id) throw new Error("ID missing");
          const { data } = await api.get(`/api/gallery/${id}`);
          ws.send(JSON.stringify({ type: "book-reply", book: parseBookData(data) }));
          break;
        }

        /* ---------- список тегов -------------------------------- */
        case "get-tags":
          ws.send(JSON.stringify({ type: "tags-reply", tags: tagsDb, updated: tagsDb.updated }));
          break;

        /* ---------- unknown ------------------------------------- */
        default:
          throw new Error(`Unknown type: ${msg.type}`);
      }

    } catch (err: any) {
      console.error(err);
      ws.send(JSON.stringify({ type: "error", message: err.message || "Unknown error" }));
    }
  });
});

let mainWindow: BrowserWindow | null = null;

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

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY).catch(console.error);
  ipcMain.on("window:minimize", () => mainWindow?.minimize());
  ipcMain.on("window:maximize", () =>
    mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize()
  );
  ipcMain.on("window:close", () => mainWindow?.close());
});

app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
