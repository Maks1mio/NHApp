import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import BookCard from "../BookCard";
import { Book } from "../BookCard";
import { FiSearch, FiRefreshCw } from "react-icons/fi";
import * as styles from "../pages.module.scss";

import { wsClient } from "../../../wsClient";
const PAGE_NUMBER = 1;
const SORT_STORAGE_KEY = "searchSortType";

type SortType = "" | "popular" | "popular-week" | "popular-today" | "popular-month";

const SORT_OPTIONS: { label: string; value: SortType }[] = [
  { label: "По релевантности", value: "" },
  { label: "Популярное (всё время)", value: "popular" },
  { label: "Популярное за неделю", value: "popular-week" },
  { label: "Популярное за день", value: "popular-today" },
  { label: "Популярное за месяц", value: "popular-month" },
];

const SearchResults: React.FC = () => {
  const location = useLocation();
  const query = new URLSearchParams(location.search).get("q") || "";

  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [sortType, setSortType] = useState<SortType>("");

  const fetchData = (type: SortType) => {
    if (!query) return;
    setLoading(true);
    setError(null);
    setBooks([]);

    // Используем общий wsClient
    // Отправляем запрос и подписываемся на ответ
    const unsubscribe = wsClient.subscribe((response: any) => {
      try {
        if (response.type === "search-results-reply") {
          setBooks(response.books || []);
          setLoading(false);
          unsubscribe();
        } else if (response.type === "error") {
          setError(response.message || "Unknown error");
          setLoading(false);
          unsubscribe();
        }
      } catch {
        setError("Invalid response from server");
        setLoading(false);
        unsubscribe();
      }
    });

    wsClient.send({
      type: "search-books",
      query,
      sort: type,
      page: PAGE_NUMBER,
    });
  };

  useEffect(() => {
    // загрузим избранное и сохранённый тип сортировки
    const favs = localStorage.getItem("bookFavorites");
    if (favs) setFavorites(JSON.parse(favs));

    const saved = localStorage.getItem(SORT_STORAGE_KEY) as SortType;
    if (saved && SORT_OPTIONS.some((o) => o.value === saved)) {
      setSortType(saved);
      fetchData(saved);
    } else {
      fetchData(sortType);
    }
  }, [query]);

  const onSortChange = (newType: SortType) => {
    if (newType === sortType) return;
    setSortType(newType);
    localStorage.setItem(SORT_STORAGE_KEY, newType);
    fetchData(newType);
  };

  const toggleFavorite = (id: number) => {
    const next = favorites.includes(id)
      ? favorites.filter((f) => f !== id)
      : [...favorites, id];
    setFavorites(next);
    localStorage.setItem("bookFavorites", JSON.stringify(next));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.mainTitle}>
          <FiSearch className={styles.searchIcon} />
          Результаты поиска: «{query}»
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
            onClick={() => fetchData(sortType)}
            disabled={loading}
            className={styles.reloadBtn}
            aria-label="Обновить"
          >
            <FiRefreshCw
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
            <button onClick={() => fetchData(sortType)} className={styles.retryBtn}>
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
            Ничего не найдено
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

export default SearchResults;
