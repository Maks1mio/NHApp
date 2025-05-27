import React, { useEffect, useState, useCallback } from "react";
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
import * as styles from "./SearchResults.module.scss";
import { wsClient } from "../../../wsClient";
import { useTagFilter } from "../../../context/TagFilterContext";

/* ─────────────────────────────  CONSTANTS  ───────────────────────────── */

const PER_PAGE                     = 25;
const SEARCH_SORT_STORAGE_KEY      = "searchResultsSortType";
const POPULAR_SORT_STORAGE_KEY     = "popularBooksSortType";
const FAVORITES_SORT_STORAGE_KEY   = "favoritesSortType";
const LS_FAVORITES_KEY             = "bookFavorites";

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
    { value: "relevance",     label: "По релевантности",       icon: <FiSearch      /> },
    { value: "popular",       label: "Популярное",             icon: <FiTrendingUp  /> },
  ],
  new: [
    { value: "newest",        label: "Сначала новые",          icon: <FiUpload      /> },
  ],
  popular: [
    { value: "popular",       label: "Популярное (всё)",       icon: <FiTrendingUp  /> },
    { value: "popular-week",  label: "Популярное (неделя)",    icon: <FiClock       /> },
    { value: "popular-today", label: "Популярное (сегодня)",   icon: <FiClock       /> },
    { value: "popular-month", label: "Популярное (месяц)",     icon: <FiClock       /> },
  ],
  favorites: [
    { value: "relevance",     label: "По дате добавления",     icon: <FiStar        /> },
    { value: "popular",       label: "По популярности",        icon: <FiTrendingUp  /> },
  ],
};

const DEFAULT_SORT: Record<ContentType, SortType> = {
  search:    "relevance",
  new:       "newest",
  popular:   "popular",
  favorites: "relevance",
};

/* ─────────────────────────────  HELPERS  ───────────────────────────── */

const getSavedSort = (
  type: ContentType,
  urlSort: SortType | null,
): SortType => {
  // 1. если в URL явно указан &sort= -- берём его
  if (urlSort && SORT_OPTIONS[type].some(o => o.value === urlSort)) {
    return urlSort;
  }

  // 2. пробуем вытащить из localStorage
  const keyMap: Record<ContentType, string> = {
    search:    SEARCH_SORT_STORAGE_KEY,
    popular:   POPULAR_SORT_STORAGE_KEY,
    favorites: FAVORITES_SORT_STORAGE_KEY,
    new:       "", // для new не храним
  };

  const storageKey = keyMap[type];
  if (storageKey) {
    const saved = localStorage.getItem(storageKey) as SortType | null;
    if (saved && SORT_OPTIONS[type].some(o => o.value === saved)) return saved;
  }

  // 3. дефолт
  return DEFAULT_SORT[type];
};

/* ─────────────────────────────  COMPONENT  ───────────────────────────── */

const SearchResults: React.FC = () => {
  /* ---------- routing / ctx ---------- */
  const { search: locSearch }   = useLocation();
  const navigate                = useNavigate();
  const queryParams             = new URLSearchParams(locSearch);

  const contentType = (queryParams.get("type") || "search") as ContentType;
  const sortFromURL = queryParams.get("sort") as SortType | null;
  const searchQuery = contentType === "search" ? queryParams.get("q") || "" : "";

  const { selectedTags } = useTagFilter();

  /* ---------- local favourites ---------- */
  const [favIds, setFavIds] = useState<number[]>(() =>
    JSON.parse(localStorage.getItem(LS_FAVORITES_KEY) ?? "[]"),
  );

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === LS_FAVORITES_KEY)
        setFavIds(JSON.parse(e.newValue ?? "[]"));
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  /* ---------- UI state ---------- */
  const initialSort = getSavedSort(contentType, sortFromURL);
  const [sortState,    setSortState]    = useState<SortType>(initialSort);
  const [books,        setBooks]        = useState<Book[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);

  /* ---------- текущий sort ---------- */
  const currentSort = sortState;

  /* ---------- helper: загрузка данных ---------- */
  const fetchData = useCallback((page = 1, sort: SortType = currentSort) => {
    // быстрый откат для избранного без элементов
    if (contentType === "favorites" && favIds.length === 0) {
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
        search:    "search-results-reply",
        new:       "new-uploads-reply",
        popular:   "popular-books-reply",
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
          sort:  sort === "relevance" ? "" : sort,
          page, perPage: PER_PAGE,
          filterTags: selectedTags,
          contentType: "search",
        });
        break;

      case "new":
        wsClient.send({
          type: "search-books",
          query: "",
          sort: "date",
          page, perPage: PER_PAGE,
          filterTags: selectedTags,
          contentType: "new",
        });
        break;

      case "popular":
        wsClient.send({
          type: "search-books",
          query: "",
          sort,
          page, perPage: PER_PAGE,
          filterTags: selectedTags,
          contentType: "popular",
        });
        break;

      case "favorites":
        wsClient.send({
          type: "get-favorites",
          ids: favIds,
          page, perPage: PER_PAGE,
          sort: sort === "popular" ? "popular" : "relevance",
        });
        break;
    }
  }, [contentType, currentSort, searchQuery, selectedTags, favIds]);

  /* ---------- первичный fetch ---------- */
  useEffect(() => {
    setSortState(initialSort);
    fetchData(1, initialSort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType, sortFromURL]);

  /* ---------- реагируем на теги ---------- */
  useEffect(() => {
    if (contentType !== "favorites") {
      fetchData(1, currentSort);
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags]);

  /* ---------- реагируем на строку поиска ---------- */
  useEffect(() => {
    if (contentType === "search") {
      fetchData(1, currentSort);
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  /* ---------- реагируем на изменение списка избранного ---------- */
  useEffect(() => {
    if (contentType === "favorites") {
      fetchData(1, currentSort);
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favIds]);

  /* ---------- пользователь меняет сортировку ---------- */
  const onSortChange = (newSort: SortType) => {
    if (newSort === currentSort) return;

    if (contentType === "popular") {
      localStorage.setItem(POPULAR_SORT_STORAGE_KEY, newSort);
      navigate(`/search?type=popular&sort=${newSort}`);
    } else if (contentType === "favorites") {
      localStorage.setItem(FAVORITES_SORT_STORAGE_KEY, newSort);
      setSortState(newSort);
      fetchData(1, newSort);
    } else if (contentType === "search") {
      localStorage.setItem(SEARCH_SORT_STORAGE_KEY, newSort);
      navigate(`/search?type=search&q=${encodeURIComponent(searchQuery)}&sort=${newSort}`);
      // навигация вызовет перерендер, сорт обновится через useEffect выше
    } else {
      setSortState(newSort);
      fetchData(1, newSort);
    }
    setCurrentPage(1);
  };

  /* ---------- toggle favourite из карточки ---------- */
  const toggleFavorite = (id: number, add: boolean) => {
    setFavIds(prev => {
      const next = add ? [...prev, id] : prev.filter(i => i !== id);
      localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  };

  /* ---------- helpers ---------- */
  const getPageTitle = () => {
    switch (contentType) {
      case "search":    return `Результаты поиска: «${searchQuery}»`;
      case "new":       return "Новые загрузки";
      case "popular":   return "Популярные работы";
      case "favorites": return `Избранное (${favIds.length})`;
      default:          return "Результаты";
    }
  };
  const getPageIcon = () => {
    switch (contentType) {
      case "search":    return <FiSearch      className={styles.searchIcon} />;
      case "new":       return <FiUpload      className={styles.searchIcon} />;
      case "popular":   return <FiTrendingUp  className={styles.searchIcon} />;
      case "favorites": return <FiStar        className={styles.searchIcon} />;
      default:          return <FiSearch      className={styles.searchIcon} />;
    }
  };

  /* ─────────────────────────────  RENDER  ───────────────────────────── */

 return (
    <div className={styles.container}>
      {/* Минималистичный хедер */}
      <div className={styles.minimalHeader}>
        <div className={styles.sortControls}>
          {SORT_OPTIONS[contentType].map(opt => (
            <button
              key={opt.value}
              className={`${styles.sortButton} ${currentSort === opt.value ? styles.active : ""}`}
              onClick={() => onSortChange(opt.value)}
              disabled={contentType === "favorites" && favIds.length === 0}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          ))}
          
          <button
            className={styles.refreshButton}
            disabled={loading || (contentType === "favorites" && favIds.length === 0)}
            onClick={() => fetchData(currentPage, currentSort)}
          >
            <FaRedo className={`${styles.refreshIcon} ${loading ? styles.spin : ""}`} />
          </button>
        </div>
      </div>

      {/* Основное содержимое */}
      <div className={styles.mainContent}>
        {/* Состояния загрузки/ошибки */}
        {error && (
          <div className={styles.errorState}>
            <div className={styles.errorContent}>
              <div className={styles.errorIcon}>⚠️</div>
              <div className={styles.errorText}>{error}</div>
              <button 
                className={styles.retryButton}
                onClick={() => fetchData(currentPage, currentSort)}
              >
                Повторить попытку
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}></div>
          </div>
        )}

        {/* Пустые состояния */}
        {!loading && contentType === "favorites" && favIds.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIllustration}>📚</div>
            <h3>Ваше избранное пусто</h3>
            <p>Сохраняйте понравившиеся работы, чтобы они появились здесь</p>
            <button 
              className={styles.primaryButton}
              onClick={() => navigate("/")}
            >
              Начать просмотр
            </button>
          </div>
        )}

        {!loading && books.length === 0 && favIds.length > 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIllustration}>🔍</div>
            <h3>Ничего не найдено</h3>
            <p>Попробуйте изменить параметры поиска или фильтры</p>
          </div>
        )}

        {/* Сетка карточек */}
        {!loading && books.length > 0 && (
          <>
            <div className={styles.booksGrid}>
              {books.map(b => (
                <BookCard
                  key={b.id}
                  book={b}
                  isFavorite={favIds.includes(b.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className={styles.paginationContainer}>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={page => fetchData(page, currentSort)}
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
