import { app, BrowserWindow, protocol, ipcMain, session } from "electron";
import { WebSocketServer } from "ws";
import axios from "axios";

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

let mainWindow: BrowserWindow | null = null;

const wss = new WebSocketServer({ port: 8080 });
const api = axios.create({
  baseURL: "https://nhentai.net",
  timeout: 5000,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "X-Requested-With, Content-Type, Accept",
  },
});

interface Book {
  id: number;
  title: {
    english: string;
    japanese: string;
    pretty: string;
  };
  uploaded: string;
  media: string;
  favorites: number;
  pagesCount: number;
  scanlator: string;
  tags: string[];
  cover: string;
  thumbnail: string;
  pages: Array<{
    page: number;
    url: string;
  }>;
}

const parseBookData = (item: any): Book => ({
  id: item.id,
  title: {
    english: item.title.english,
    japanese: item.title.japanese,
    pretty: item.title.pretty,
  },
  uploaded: item.upload_date
    ? new Date(item.upload_date * 1000).toISOString()
    : "",
  media: item.media_id,
  favorites: item.num_favorites,
  pagesCount: item.num_pages,
  scanlator: item.scanlator || "",
  tags: item.tags || [],
  cover: item.images?.cover
    ? `https://t3.nhentai.net/galleries/${item.media_id}/cover.${
        item.images.cover.t === "j" ? "jpg" : "png"
      }`
    : "",
  thumbnail: item.images?.thumbnail
    ? `https://t3.nhentai.net/galleries/${item.media_id}/thumb.${
        item.images.thumbnail.t === "j" ? "jpg" : "png"
      }`
    : "",
  //     cover: item.images?.cover
  //   ? `https://i3.nhentai.net/galleries/${item.media_id}/1.${
  //       item.images.cover.t === "j" ? "jpg" : "png"
  //     }`
  //   : "",
  // thumbnail: item.images?.thumbnail
  //   ? `https://i3.nhentai.net/galleries/${item.media_id}/1.${
  //       item.images.thumbnail.t === "j" ? "jpg" : "png"
  //     }`
  //   : "",
  pages: Array.from({ length: item.num_pages }, (_, i) => ({
    page: i + 1,
    url: `https://i3.nhentai.net/galleries/${item.media_id}/${i + 1}.${
      item.images.pages[i]?.t === "j" ? "jpg" : "png"
    }`,
  })),
});

async function searchBooks(
  query: string,
  page: number,
  sort?: string
): Promise<Book[]> {
  const params: any = { query, page };

  if (sort) {
    const validSorts = [
      "popular",
      "popular-today",
      "popular-week",
      "popular-month",
    ];
    if (validSorts.includes(sort)) {
      params.sort = sort;
    }
  }

  try {
    const response = await api.get("/api/galleries/search", { params });
    return response.data.result.map(parseBookData);
  } catch (error) {
    console.error("Search error:", error);
    throw error;
  }
}

async function getFavorites(ids: number[]): Promise<Book[]> {
  const promises = ids.map((id) =>
    api
      .get(`/api/gallery/${id}`)
      .then((res) => parseBookData(res.data))
      .catch((err): null => {
        console.error(`Error loading book ${id}:`, err);
        return null;
      })
  );
  const results = await Promise.all(promises);
  return results.filter((book) => book !== null) as Book[];
}

async function fetchBooks(type: string, page = 1): Promise<Book[]> {
  try {
    const isPopular = type !== "new";
    let endpoint: "/api/galleries/all" | "/api/galleries/search" =
      "/api/galleries/all";
    const params: any = { page };

    if (isPopular) {
      endpoint = "/api/galleries/search";
      params.query = " ";
      params.sort = type;
    }

    const response = await api.get(endpoint, { params });
    return response.data.result.map(parseBookData);
  } catch (err) {
    console.error(`Error fetching ${type}:`, err);
    throw err;
  }
}

async function getBookById(id: number): Promise<Book> {
  const res = await api.get(`/api/gallery/${id}`);
  return parseBookData(res.data);
}

wss.on("connection", (ws) => {
  console.log("WebSocket connection opened");

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString());
      const { type, id, page = 1, query, ids, sort } = data;

      // <-- новая ветка для get-book -->
      if (type === "get-book") {
        if (!id) throw new Error("ID книги не задан");
        const book = await getBookById(id);
        ws.send(JSON.stringify({ type: "book-reply", book }));
        return;
      }
      // <-- конец новой ветки -->

      if (type.startsWith("get-popular")) {
        const key = type.replace("get-", "");
        const books = await fetchBooks(key, page);
        ws.send(JSON.stringify({ type: "popular-books-reply", books }));
      } else if (type === "get-new-uploads") {
        const books = await fetchBooks("new", page);
        ws.send(JSON.stringify({ type: "new-uploads-reply", books }));
      } else if (type === "search-books") {
        if (!query) throw new Error("Query parameter is required");
        const books = await searchBooks(query, page, sort);
        ws.send(JSON.stringify({ type: "search-results-reply", books }));
      } else if (type === "get-favorites") {
        if (!ids || !Array.isArray(ids))
          throw new Error("Ids array is required");
        const books = await getFavorites(ids);
        ws.send(JSON.stringify({ type: "favorites-reply", books }));
      } else {
        throw new Error(`Unknown message type: ${type}`);
      }
    } catch (err: any) {
      console.error("Request processing error:", err);
      ws.send(
        JSON.stringify({
          type: "error",
          message: err.message || "Unknown error",
        })
      );
    }
  });

  ws.on("close", () => console.log("WebSocket connection closed"));
});

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
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
  ipcMain.on("window:maximize", () => {
    mainWindow?.isMaximized()
      ? mainWindow?.unmaximize()
      : mainWindow?.maximize();
  });
  ipcMain.on("window:close", () => mainWindow?.close());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
