/* -------------------------------------------------------------------------- */
/*  main.ts – Electron + WebSocket gateway for nHentai client                 */
/*  Обновлено: фикс импорта processOptions + упрощённый вызов + советы по     */
/*  node‑gyp (см. комментарии ниже).                                          */
/* -------------------------------------------------------------------------- */

import { app, BrowserWindow, protocol, ipcMain, session } from "electron";
import { WebSocketServer } from "ws";
import axios, { AxiosRequestConfig } from "axios";
// 👉 правильный путь до утилиты — в published‑версии библиотека лежит в dist
import { Agent } from "https";
import { API } from "nhentai-api";

// Создаем экземпляр API
const nh = new API({
  agent: new Agent(),
  hosts: {
    api: "nhentai.net",
    images: "i.nhentai.net",
    thumbs: "t.nhentai.net",
  },
  ssl: true,
});

// Если у тебя есть собственный keep‑alive/прокси‑агент, закинь его сюда:
// const myAgent = new HttpsAgent({ keepAlive: true, proxy: ... });
// const { hosts, ssl, agent } = processOptions({ ssl: true, agent: myAgent });

/* -------------------------------------------------------------------------- */
/*  Electron / scheme setup                                                   */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/*  Axios helpers                                                             */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */
type OrigExt = "jpg" | "png" | "webp" | "gif";

const extByToken = (t: "j" | "p" | "w" | "g"): OrigExt => {
  switch (t) {
    case "j":
      return "jpg";
    case "p":
      return "png";
    case "w":
      return "webp";
    case "g":
      return "gif";
    default:
      throw new Error(`Unknown image token: ${t}`);
  }
};

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */
interface Book {
  id: number;
  title: { english: string; japanese: string; pretty: string };
  uploaded: string;
  media: number;
  favorites: number;
  pagesCount: number;
  scanlator: string;
  tags: any[];
  cover: string;
  thumbnail: string;
  pages: { page: number; url: string }[];
}

interface PaginatedResponse {
  books: Book[];
  totalPages: number;
  currentPage: number;
}

/* -------------------------------------------------------------------------- */
/*  СИНХРОННЫЙ парсер книги                                                   */
/* -------------------------------------------------------------------------- */
const parseBookData = (item: any): Book => {
  const media = item.media_id;

  // расширения для обложек
  const coverExt = extByToken(item.images.cover?.t || "j");
  const thumbExt = extByToken(item.images.thumbnail?.t || "j");

  const coverBase = `https://t3.nhentai.net/galleries/${media}/cover`;
  const thumbBase = `https://t3.nhentai.net/galleries/${media}/thumb`;

  // страницы
  const pages = Array.from({ length: item.num_pages }, (_, i) => {
    const pageToken = item.images.pages[i]?.t || "j";
    const pageExt = extByToken(pageToken);
    const pageBase = `https://i3.nhentai.net/galleries/${media}/${i + 1}`;
    const pageBaseThumb = `https://t1.nhentai.net/galleries/${media}/${i + 1}t`;

    return {
      page: i + 1,
      url: `${pageBase}.${pageExt}`, // то же поведение, что у cover/thumbnail
      urlThumb: `${pageBaseThumb}.${pageExt}`, // то же поведение, что у cover/thumbnail
    };
  });

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
    tags: item.tags || [],
    cover: `${coverBase}.${coverExt}`,
    thumbnail: `${thumbBase}.${thumbExt}`,
    pages,
  };
};

/* -------------------------------------------------------------------------- */
/*  API wrappers (search / fetch / get)                                       */
/* -------------------------------------------------------------------------- */
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
  return {
    books,
    totalPages: paginate(data.num_pages, perPage),
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

/* -------------------------------------------------------------------------- */
/*  WebSocket server                                                          */
/* -------------------------------------------------------------------------- */
const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
  ws.on("message", async (msg) => {
    try {
      const {
        type,
        id,
        page = 1,
        query,
        ids,
        sort,
        perPage = 25,
      } = JSON.parse(msg.toString());

      switch (type) {
        case "get-book": {
          if (!id) throw new Error("ID missing");
          const book = await getBookById(id);
          return ws.send(JSON.stringify({ type: "book-reply", book }));
        }
        case "get-new-uploads":
        case "get-popular":
        case "get-popular-today":
        case "get-popular-week":
        case "get-popular-month": {
          const key = type.replace("get-", "");
          const kind = key === "new-uploads" ? "new" : key;
          const data = await fetchBooks(kind, page, perPage);
          return ws.send(
            JSON.stringify({
              type:
                key === "new-uploads"
                  ? "new-uploads-reply"
                  : "popular-books-reply",
              ...data,
            })
          );
        }
        case "search-books": {
          if (!query) throw new Error("Query missing");
          const data = await searchBooks(query, page, sort, perPage);
          return ws.send(
            JSON.stringify({ type: "search-results-reply", ...data })
          );
        }
        case "get-favorites": {
          if (!ids?.length) throw new Error("Ids array required");
          const books = await getFavorites(ids);
          return ws.send(
            JSON.stringify({
              type: "favorites-reply",
              books,
              totalPages: 1,
              currentPage: 1,
            })
          );
        }
        default:
          throw new Error(`Unknown type: ${type}`);
      }
    } catch (err: any) {
      console.error(err);
      ws.send(
        JSON.stringify({
          type: "error",
          message: err?.message || "Unknown error",
        })
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/*  Electron window                                                           */
/* -------------------------------------------------------------------------- */
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
