import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import * as styles from "../pages.module.scss";
import BookCard from "../../components/BookCard";
import { FaFire, FaRedo } from "react-icons/fa";
import { Book } from "../../components/BookCard";

const WS_URL = "ws://localhost:8080";
const PAGE_NUMBER = 1;
const SORT_STORAGE_KEY = "popularBooksSortType";

type SortType =
  | "get-popular"
  | "get-popular-week"
  | "get-popular-today"
  | "get-popular-month";

const SORT_OPTIONS: { label: string; value: SortType }[] = [
  { label: "Всё время", value: "get-popular" },
  { label: "За неделю", value: "get-popular-week" },
  { label: "За день", value: "get-popular-today" },
  { label: "За месяц", value: "get-popular-month" },
];

const LABEL_MAP: Record<SortType, string> = {
  "get-popular": "Популярное (всё время)",
  "get-popular-week": "Популярное за неделю",
  "get-popular-today": "Популярное за день",
  "get-popular-month": "Популярное за месяц",
};

const PopularBooks: React.FC = () => {
  const location = useLocation();
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [sortType, setSortType] = useState<SortType>("get-popular-today");

  const fetchData = (type: SortType) => {
    setLoading(true);
    setError(null);
    setBooks([]);

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type, page: PAGE_NUMBER }));
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data) as {
          type: string;
          books?: Book[];
          message?: string;
        };

        if (response.type === "popular-books-reply") {
          setBooks(response.books || []);
        } else if (response.type === "error") {
          setError(response.message || "Unknown error");
        }
      } catch {
        setError("Invalid response from server");
      } finally {
        setLoading(false);
        ws.close();
      }
    };

    ws.onerror = () => {
      setError("Connection error");
      setLoading(false);
      ws.close();
    };
  };

  const fetchDataByTags = (tags: string[], type: SortType) => {
    setLoading(true);
    setError(null);
    setBooks([]);

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "get-books-by-tags",
          tags,
          page: PAGE_NUMBER,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        if (response.type === "tagged-books-reply") {
          setBooks(response.books || []);
        } else if (response.type === "error") {
          setError(response.message || "Unknown error");
        }
      } catch {
        setError("Invalid response from server");
      } finally {
        setLoading(false);
        ws.close();
      }
    };

    ws.onerror = () => {
      setError("Connection error");
      setLoading(false);
      ws.close();
    };
  };

  useEffect(() => {
    // Загружаем избранное и сохраненный тип сортировки
    const favs = localStorage.getItem("bookFavorites");
    const savedSortType = localStorage.getItem(SORT_STORAGE_KEY) as SortType;

    if (favs) setFavorites(JSON.parse(favs));
    if (
      savedSortType &&
      SORT_OPTIONS.some((opt) => opt.value === savedSortType)
    ) {
      setSortType(savedSortType);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tagsParam = params.get("tags");
    const tags = tagsParam ? tagsParam.split(",") : [];

    if (tags.length > 0 && tags[0] !== "") {
      fetchDataByTags(tags, sortType);
    } else {
      fetchData(sortType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, sortType]);

  const onSortChange = (newType: SortType) => {
    if (newType === sortType) return;
    setSortType(newType);
    localStorage.setItem(SORT_STORAGE_KEY, newType);
    // fetchData(newType); // теперь вызывается через useEffect
  };

  const toggleFavorite = (id: number) => {
    const newFavs = favorites.includes(id)
      ? favorites.filter((fav) => fav !== id)
      : [...favorites, id];
    setFavorites(newFavs);
    localStorage.setItem("bookFavorites", JSON.stringify(newFavs));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.mainTitle}>
          <FaFire className={styles.fireIcon} />
          Популярное за{" "}
          {sortType === "get-popular-today"
            ? "день"
            : sortType === "get-popular-week"
            ? "неделю"
            : sortType === "get-popular-month"
            ? "месяц"
            : "всё время"}
        </h1>

        <div className={styles.sortSelector}>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.sortOption} ${
                sortType === opt.value ? styles.active : ""
              }`}
              onClick={() => onSortChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => {
              const params = new URLSearchParams(location.search);
              const tagsParam = params.get("tags");
              const tags = tagsParam ? tagsParam.split(",") : [];
              if (tags.length > 0 && tags[0] !== "") {
                fetchDataByTags(tags, sortType);
              } else {
                fetchData(sortType);
              }
            }}
            disabled={loading}
            className={styles.reloadBtn}
            aria-label="Обновить"
          >
            <FaRedo
              className={`${styles.reloadIcon} ${loading ? styles.spin : ""}`}
            />
            Обновить
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {error ? (
          <div className={styles.error}>
            Ошибка: {error}
            <button
              onClick={() => {
                const params = new URLSearchParams(location.search);
                const tagsParam = params.get("tags");
                const tags = tagsParam ? tagsParam.split(",") : [];
                if (tags.length > 0 && tags[0] !== "") {
                  fetchDataByTags(tags, sortType);
                } else {
                  fetchData(sortType);
                }
              }}
              className={styles.retryBtn}
            >
              Повторить
            </button>
          </div>
        ) : loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
            Загрузка...
          </div>
        ) : books.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>😕</div>
            Нет популярных книг
          </div>
        ) : (
          <div className={styles.grid}>
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                isFavorite={favorites.includes(book.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PopularBooks;