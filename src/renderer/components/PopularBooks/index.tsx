import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import * as styles from "../pages.module.scss";
import BookCard from "../../components/BookCard";
import { FaFire, FaRedo } from "react-icons/fa";
import { Book } from "../../components/BookCard";
import { wsClient } from "../../../wsClient";
import Pagination from "../../components/Pagination";

const SORT_STORAGE_KEY = "popularBooksSortType";
const PER_PAGE = 25;

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

interface PopularResponse {
  type: string;
  books?: Book[];
  totalPages?: number;
  currentPage?: number;
  message?: string;
}

const PopularBooks: React.FC = () => {
  const location = useLocation();
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [sortType, setSortType] = useState<SortType>("get-popular-today");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = (type: SortType, page = 1) => {
    setLoading(true);
    setError(null);
    setBooks([]);

    const unsubscribe = wsClient.subscribe((response: PopularResponse) => {
      if (response.type === "popular-books-reply") {
        setBooks(response.books || []);
        setTotalPages(response.totalPages ?? 1);
        setCurrentPage(response.currentPage ?? page);
        setLoading(false);
        unsubscribe();
      } else if (response.type === "error") {
        setError(response.message || "Unknown error");
        setLoading(false);
        unsubscribe();
      }
    });

    wsClient.send({ type, page, perPage: PER_PAGE });
  };

  const fetchDataByTags = (tags: string[], type: SortType, page = 1) => {
    setLoading(true);
    setError(null);
    setBooks([]);

    const unsubscribe = wsClient.subscribe((response: PopularResponse) => {
      if (response.type === "tagged-books-reply") {
        setBooks(response.books || []);
        setTotalPages(response.totalPages ?? 1);
        setCurrentPage(response.currentPage ?? page);
        setLoading(false);
        unsubscribe();
      } else if (response.type === "error") {
        setError(response.message || "Unknown error");
        setLoading(false);
        unsubscribe();
      }
    });

    wsClient.send({ type: "get-books-by-tags", tags, page, perPage: PER_PAGE });
  };

  // загрузка фаворитов и сохранённого типа
  useEffect(() => {
    const favs = localStorage.getItem("bookFavorites");
    const savedSortType = localStorage.getItem(SORT_STORAGE_KEY) as SortType;
    if (favs) setFavorites(JSON.parse(favs));
    if (savedSortType && SORT_OPTIONS.some((o) => o.value === savedSortType)) {
      setSortType(savedSortType);
    }
  }, []);

  // при изменении тэгов или сортировки — подгружаем страницу 1
  useEffect(() => {
    setCurrentPage(1);
    const params = new URLSearchParams(location.search);
    const tagsParam = params.get("tags");
    const tags = tagsParam ? tagsParam.split(",") : [];

    if (tags.length && tags[0] !== "") {
      fetchDataByTags(tags, sortType, 1);
    } else {
      fetchData(sortType, 1);
    }
  }, [location.search, sortType]);

  const onSortChange = (newType: SortType) => {
    if (newType === sortType) return;
    setSortType(newType);
    localStorage.setItem(SORT_STORAGE_KEY, newType);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const params = new URLSearchParams(location.search);
    const tagsParam = params.get("tags");
    const tags = tagsParam ? tagsParam.split(",") : [];
    if (tags.length && tags[0] !== "") {
      fetchDataByTags(tags, sortType, page);
    } else {
      fetchData(sortType, page);
    }
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
          {LABEL_MAP[sortType]}
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
        {error ? (
          <div className={styles.error}>
            Ошибка: {error}
            <button onClick={() => handlePageChange(currentPage)} className={styles.retryBtn}>
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

export default PopularBooks;
