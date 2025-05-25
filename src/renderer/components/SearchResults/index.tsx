import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import BookCard from "../BookCard";
import { Book } from "../BookCard";
import { FiSearch, FiRefreshCw } from "react-icons/fi";
import * as styles from "../pages.module.scss";
import { wsClient } from "../../../wsClient";
import Pagination from "../Pagination";
import { FaRedo } from "react-icons/fa";

const SORT_STORAGE_KEY = "searchSortType";
const PER_PAGE = 25;

type SortType = "" | "popular" | "popular-week" | "popular-today" | "popular-month";

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: "", label: "По релевантности" },
  { value: "popular", label: "Популярное (всё время)" },
  { value: "popular-week", label: "Популярное (неделя)" },
  { value: "popular-today", label: "Популярное (сегодня)" },
  { value: "popular-month", label: "Популярное (месяц)" },
];

interface SearchResponse {
  type: string;
  books?: Book[];
  totalPages?: number;
  currentPage?: number;
  message?: string;
}

const SearchResults: React.FC = () => {
  const location = useLocation();
  const query = new URLSearchParams(location.search).get("q") || "";

  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [sortType, setSortType] = useState<SortType>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = (page: number = 1, sort: SortType = "") => {
    if (!query) return;
    setLoading(true);
    setError(null);
    setBooks([]);

    const unsubscribe = wsClient.subscribe((response: SearchResponse) => {
      if (response.type === "search-results-reply") {
        setBooks(response.books || []);
        setTotalPages(response.totalPages ?? 1);
        setCurrentPage(response.currentPage ?? 1);
        setLoading(false);
        unsubscribe();
      } else if (response.type === "error") {
        setError(response.message || "Unknown error");
        setLoading(false);
        unsubscribe();
      }
    });

    wsClient.send({
      type: "search-books",
      query,
      sort,
      page,
      perPage: PER_PAGE,
    });
  };

  useEffect(() => {
    // инициализация фаворитов и сортировки
    const favs = localStorage.getItem("bookFavorites");
    if (favs) setFavorites(JSON.parse(favs));
    const saved = localStorage.getItem(SORT_STORAGE_KEY) as SortType;
    if (saved) setSortType(saved);

    // сразу подгружаем первую страницу
    fetchData(1, saved || sortType);
    // eslint-disable-next-line
  }, [query]);

  const onSortChange = (newType: SortType) => {
    if (newType === sortType) return;
    setSortType(newType);
    localStorage.setItem(SORT_STORAGE_KEY, newType);
    fetchData(1, newType);
  };

  const handlePageChange = (page: number) => {
    fetchData(page, sortType);
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
            onClick={() => handlePageChange(currentPage)}
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
        {error && (
          <div className={styles.error}>
            Ошибка: {error}
            <button onClick={() => fetchData(currentPage, sortType)} className={styles.retryBtn}>
              Повторить
            </button>
          </div>
        )}
        {loading && (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
            Загрузка...
          </div>
        )}
        {!loading && books.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>😕</div>
            Ничего не найдено
          </div>
        )}
        {!loading && books.length > 0 && (
          <>
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
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default SearchResults;
