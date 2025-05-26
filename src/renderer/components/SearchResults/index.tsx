import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BookCard, { Book } from "../BookCard";
import Pagination from "../Pagination";
import {
  FiSearch,
  FiClock,
  FiStar,
  FiTrendingUp,
  FiUpload,
} from "react-icons/fi";
import { FaRedo } from "react-icons/fa";
import * as styles from "../pages.module.scss";
import { wsClient } from "../../../wsClient";
import { useTagFilter } from "../../../context/TagFilterContext";
import { useFavorites } from "../../../context/FavoritesContext";

/* ─────────────────────────────── constants ─────────────────────────────── */
const PER_PAGE = 25;
const SEARCH_SORT_STORAGE_KEY = "searchResultsSortType";
const POPULAR_SORT_STORAGE_KEY = "popularBooksSortType";
const FAVORITES_SORT_STORAGE_KEY = "favoritesSortType";

type ContentType = "search" | "new" | "popular" | "favorites";
type SortType =
  | "relevance"
  | "popular"
  | "popular-week"
  | "popular-today"
  | "popular-month"
  | "newest";

const SORT_OPTIONS: Record<
  ContentType,
  { value: SortType; label: string; icon: React.ReactNode }[]
> = {
  search: [
    { value: "relevance", label: "По релевантности", icon: <FiSearch /> },
    { value: "popular", label: "Популярное", icon: <FiTrendingUp /> },
  ],
  new: [{ value: "newest", label: "Сначала новые", icon: <FiUpload /> }],
  popular: [
    {
      value: "popular",
      label: "Популярное (всё время)",
      icon: <FiTrendingUp />,
    },
    { value: "popular-week", label: "Популярное (неделя)", icon: <FiClock /> },
    {
      value: "popular-today",
      label: "Популярное (сегодня)",
      icon: <FiClock />,
    },
    { value: "popular-month", label: "Популярное (месяц)", icon: <FiClock /> },
  ],
  favorites: [
    { value: "relevance", label: "По дате добавления", icon: <FiStar /> },
    { value: "popular", label: "По популярности", icon: <FiTrendingUp /> },
  ],
};

const DEFAULT_SORT: Record<ContentType, SortType> = {
  search: "relevance",
  new: "newest",
  popular: "popular",
  favorites: "relevance",
};

/* ─────────────────────────────── component ─────────────────────────────── */
const SearchResults: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);

  const contentType = (queryParams.get("type") || "search") as ContentType;
  const sortFromUrl = queryParams.get("sort") as SortType | null;
  const searchQuery =
    contentType === "search" ? queryParams.get("q") || "" : "";

  const { selectedTags } = useTagFilter();
  const { favorites } = useFavorites();

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortState, setSortState] = useState<SortType>(
    DEFAULT_SORT[contentType]
  );

  /* ───────────── актуальная сортировка ───────────── */
  const currentSort: SortType = (() => {
    if (contentType === "popular") {
      if (
        sortFromUrl &&
        SORT_OPTIONS.popular.some((o) => o.value === sortFromUrl)
      ) {
        return sortFromUrl;
      }
      const saved = localStorage.getItem(
        POPULAR_SORT_STORAGE_KEY
      ) as SortType | null;
      return saved && SORT_OPTIONS.popular.some((o) => o.value === saved)
        ? saved
        : "popular";
    }

    if (contentType === "favorites") {
      const saved = localStorage.getItem(
        FAVORITES_SORT_STORAGE_KEY
      ) as SortType | null;
      return saved && SORT_OPTIONS.favorites.some((o) => o.value === saved)
        ? saved
        : "relevance";
    }

    return sortState;
  })();

  /* ───────────── fetch helper ───────────── */
  const fetchData = (page = 1, sort: SortType = currentSort) => {
    /** пустое избранное – показываем стейт без запроса */
    if (contentType === "favorites" && favorites.length === 0) {
      setBooks([]);
      setTotalPages(1);
      setCurrentPage(1);
      return;
    }

    setLoading(true);
    setError(null);
    const unsub = wsClient.subscribe((res) => {
      if (res.type === "error") {
        setError(res.message || "Unknown error");
        setLoading(false);
        unsub();
        return;
      }

      const map: Record<ContentType, string> = {
        search: "search-results-reply",
        new: "new-uploads-reply",
        popular: "popular-books-reply",
        favorites: "favorites-reply",
      };

      if (res.type === map[contentType]) {
        setBooks(res.books || []);
        setTotalPages(res.totalPages ?? 1);
        setCurrentPage(res.currentPage ?? 1);
        setLoading(false);
        unsub();
      }
    });

    switch (contentType) {
      case "search":
        wsClient.send({
          type: "search-books",
          query: searchQuery,
          sort: sort === "relevance" ? "" : sort,
          page,
          perPage: PER_PAGE,
          filterTags: selectedTags,
          contentType: "search",
        });
        break;

      case "new":
        wsClient.send({
          type: "search-books",
          query: "",
          sort: "date",
          page,
          perPage: PER_PAGE,
          filterTags: selectedTags,
          contentType: "new",
        });
        break;

      case "popular":
        wsClient.send({
          type: "search-books",
          query: "",
          sort,
          page,
          perPage: PER_PAGE,
          filterTags: selectedTags,
          contentType: "popular",
        });
        break;

      case "favorites":
        wsClient.send({
          type: "get-favorites",
          ids: favorites,
          page,
          perPage: PER_PAGE,
          sort: sort === "popular" ? "popular" : "relevance",
        });
        break;
    }
  };

  /* ───────────── первая загрузка / смена типа ───────────── */
  useEffect(() => {
    const init = () => {
      if (contentType === "popular" || contentType === "favorites")
        return currentSort;
      const saved = localStorage.getItem(
        SEARCH_SORT_STORAGE_KEY
      ) as SortType | null;
      return saved && SORT_OPTIONS[contentType].some((o) => o.value === saved)
        ? saved
        : DEFAULT_SORT[contentType];
    };

    const initial = init();
    setSortState(initial);
    fetchData(1, initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, sortFromUrl]);

  /* ───────────── смена тегов ───────────── */
  useEffect(() => {
    if (contentType !== "favorites") {
      fetchData(1, currentSort);
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags]);

  /* ───────────── текстовый поиск ───────────── */
  useEffect(() => {
    if (contentType === "search") {
      fetchData(1, currentSort);
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  /* ───────────── изменения списка избранного ───────────── */
  useEffect(() => {
    if (contentType === "favorites") {
      fetchData(1, currentSort);
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites]);

  /* ───────────── пользователь меняет сортировку ───────────── */
  const onSortChange = (newSort: SortType) => {
    if (newSort === currentSort) return;

    if (contentType === "popular") {
      localStorage.setItem(POPULAR_SORT_STORAGE_KEY, newSort);
      navigate(`/search?type=popular&sort=${newSort}`);
    } else if (contentType === "favorites") {
      localStorage.setItem(FAVORITES_SORT_STORAGE_KEY, newSort);
      setSortState(newSort);
      fetchData(1, newSort);
    } else {
      localStorage.setItem(SEARCH_SORT_STORAGE_KEY, newSort);
      setSortState(newSort);
      fetchData(1, newSort);
    }
    setCurrentPage(1);
  };

  /* ───────────── страничная навигация ───────────── */
  const onPageChange = (page: number) => fetchData(page, currentSort);

  /* ───────────── helpers ───────────── */
  const getPageTitle = () => {
    switch (contentType) {
      case "search":
        return `Результаты поиска: «${searchQuery}»`;
      case "new":
        return "Новые загрузки";
      case "popular":
        return "Популярные работы";
      case "favorites":
        return `Избранное (${favorites.length})`;
      default:
        return "Результаты";
    }
  };
  const getPageIcon = () => {
    switch (contentType) {
      case "search":
        return <FiSearch className={styles.searchIcon} />;
      case "new":
        return <FiUpload className={styles.searchIcon} />;
      case "popular":
        return <FiTrendingUp className={styles.searchIcon} />;
      case "favorites":
        return <FiStar className={styles.searchIcon} />;
      default:
        return <FiSearch className={styles.searchIcon} />;
    }
  };

  /* ─────────────────────────────── render ─────────────────────────────── */
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.mainTitle}>
            {getPageIcon()}
            {getPageTitle()}
          </h1>

          <div className={styles.sortSelector}>
            {SORT_OPTIONS[contentType].map((opt) => (
              <button
                key={opt.value}
                className={`${styles.sortOption} ${
                  currentSort === opt.value ? styles.active : ""
                }`}
                onClick={() => onSortChange(opt.value)}
                disabled={contentType === "favorites" && favorites.length === 0}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}

            <button
              className={styles.reloadBtn}
              disabled={
                loading || (contentType === "favorites" && favorites.length === 0)
              }
              onClick={() => fetchData(currentPage, currentSort)}
              aria-label="Обновить"
            >
              <FaRedo
                className={`${styles.reloadIcon} ${loading ? styles.spin : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {error && (
          <div className={styles.error}>
            <div className={styles.errorIcon}>⚠️</div>
            <div className={styles.errorText}>Ошибка: {error}</div>
            <button
              className={styles.retryBtn}
              onClick={() => fetchData(currentPage, currentSort)}
            >
              Повторить
            </button>
          </div>
        )}

        {loading && (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
            <div className={styles.loadingText}>Загрузка...</div>
          </div>
        )}

        {!loading && contentType === "favorites" && favorites.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⭐</div>
            <h3 className={styles.emptyTitle}>В избранном пока ничего нет</h3>
            <p className={styles.emptySubtitle}>
              Добавляйте понравившиеся работы, чтобы они появились здесь
            </p>
            <button
              className={styles.emptyAction}
              onClick={() => navigate("/")}
            >
              Перейти к поиску
            </button>
          </div>
        )}

        {!loading && books.length === 0 && favorites.length > 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🔍</div>
            <h3 className={styles.emptyTitle}>Ничего не найдено</h3>
            <p className={styles.emptySubtitle}>
              Попробуйте изменить параметры поиска
            </p>
          </div>
        )}

        {!loading && books.length > 0 && (
          <>
            <div className={styles.grid}>
              {books.map((b) => (
                <BookCard
                  key={b.id}
                  book={b}
                  isFavorite={favorites.includes(b.id)}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className={styles.paginationWrapper}>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={onPageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SearchResults;