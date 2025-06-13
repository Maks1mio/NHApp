import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BookCard, { Book } from "../BookCard";
import Pagination from "../Pagination";
import { FiSearch, FiTrendingUp } from "react-icons/fi";
import { FaRedo } from "react-icons/fa";
import * as styles from "./SearchResults.module.scss";
import { wsClient } from "../../../wsClient";
import { useTagFilter } from "../../../context/TagFilterContext";

const PER_PAGE = 25;
const SEARCH_SORT_STORAGE_KEY = "searchResultsSortType";
const LS_FAVORITES_KEY = "bookFavorites";

type SortType = "relevance" | "popular";

const SORT_OPTIONS: {
  value: SortType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "relevance", label: "By relevance", icon: <FiSearch /> },
  { value: "popular", label: "Popular", icon: <FiTrendingUp /> },
];

const SearchResultsSearch: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const qp = new URLSearchParams(location.search);

  const searchQuery = qp.get("q") || "";
  const sortFromURL = qp.get("sort") as SortType | null;
  const pageFromURL = parseInt(qp.get("page") || "1", 10);
  const typeFromURL = qp.get("type") || "search";

  const { selectedTags } = useTagFilter();

  const [favIds, setFavIds] = useState<number[]>(() =>
    JSON.parse(localStorage.getItem(LS_FAVORITES_KEY) ?? "[]")
  );

  useEffect(() => {
    const h = (e: StorageEvent) => {
      if (e.key === LS_FAVORITES_KEY) setFavIds(JSON.parse(e.newValue ?? "[]"));
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, []);

  const initialSort =
    sortFromURL && SORT_OPTIONS.some((o) => o.value === sortFromURL)
      ? sortFromURL
      : (localStorage.getItem(SEARCH_SORT_STORAGE_KEY) as SortType) ||
        "relevance";

  const [sortState, setSortState] = useState<SortType>(initialSort);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(pageFromURL);
  const [totalPages, setTotalPages] = useState(1);
  const lastRequestId = useRef<number>(0);

  const fetchData = useCallback(
    (page = 1, sort: SortType = sortState) => {
      setLoading(true);
      setError(null);
      setCurrentPage(page);

      const requestId = Date.now();
      lastRequestId.current = requestId;

      const unsub = wsClient.subscribe((res) => {
        if (lastRequestId.current !== requestId) return;

        if (res.type === "error") {
          setError(res.message || "Unknown error");
          setLoading(false);
          return unsub();
        }
        if (res.type === "search-results-reply") {
          setBooks(res.books || []);
          setTotalPages(res.totalPages || 1);
          setCurrentPage(res.page || page);
          setLoading(false);
          unsub();
        }
      });

      wsClient.send({
        type: "search-books",
        query: searchQuery,
        sort: sort === "relevance" ? "" : sort,
        page,
        perPage: PER_PAGE,
        filterTags: selectedTags,
        contentType: typeFromURL as any,
      });
    },
    [searchQuery, selectedTags, sortState, typeFromURL]
  );

  // Initial fetch on mount
  useEffect(() => {
    fetchData(pageFromURL, initialSort);
  }, [pageFromURL, initialSort, fetchData]);

  // Обработка изменений URL
  useEffect(() => {
    const newPage = parseInt(qp.get("page") || "1", 10);
    const newSort = qp.get("sort") as SortType | null;
    const newType = qp.get("type") || "search";

    // Если изменилась страница, сортировка или тип - делаем новый запрос
    if (
      newPage !== currentPage ||
      (newSort && newSort !== sortState) ||
      newType !== typeFromURL
    ) {
      const effectiveSort = newSort || sortState;
      setCurrentPage(newPage);
      if (newSort && newSort !== sortState) {
        setSortState(newSort);
        localStorage.setItem(SEARCH_SORT_STORAGE_KEY, newSort);
      }
      fetchData(newPage, effectiveSort);
    }
  }, [location.search]);

  const onSortChange = (s: SortType) => {
    if (s === sortState) return;
    localStorage.setItem(SEARCH_SORT_STORAGE_KEY, s);
    setSortState(s);
    navigate(
      `/search?type=search&q=${encodeURIComponent(
        searchQuery
      )}&sort=${s}&page=1`
    );
    fetchData(1, s); // Explicitly fetch data with the new sort
  };

  const onPageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    navigate(
      `/search?type=search&q=${encodeURIComponent(
        searchQuery
      )}&sort=${sortState}&page=${page}`
    );
    fetchData(page, sortState);
  };

  const toggleFavorite = (id: number, add: boolean) => {
    setFavIds((prev) => {
      const next = add ? [...prev, id] : prev.filter((i) => i !== id);
      localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.minimalHeader}>
        <div className={styles.sortControls}>
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={`${styles.sortButton} ${
                sortState === o.value ? styles.active : ""
              }`}
              onClick={() => onSortChange(o.value)}
            >
              {o.icon}
              <span>{o.label}</span>
            </button>
          ))}
          <button
            className={styles.refreshButton}
            disabled={loading}
            onClick={() => fetchData(currentPage, sortState)}
          >
            <FaRedo
              className={`${styles.refreshIcon} ${loading ? styles.spin : ""}`}
            />
          </button>
        </div>
      </div>

      <div className={styles.mainContent}>
        {error && (
          <ErrorBlock
            msg={error}
            retry={() => fetchData(currentPage, sortState)}
          />
        )}
        {loading && <LoadingBlock />}
        {!loading && books.length === 0 && <EmptySearch />}

        {!loading && books.length > 0 && (
          <>
            <div className={styles.booksGrid}>
              {books.map((b) => (
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

const LoadingBlock = () => (
  <div className={styles.loadingState}>
    <div className={styles.loadingSpinner} />
  </div>
);

const ErrorBlock: React.FC<{ msg: string; retry: () => void }> = ({
  msg,
  retry,
}) => (
  <div className={styles.errorState}>
    <div className={styles.errorContent}>
      <div className={styles.errorIcon}>⚠️</div>
      <div className={styles.errorText}>{msg}</div>
      <button className={styles.retryButton} onClick={retry}>
        Retry
      </button>
    </div>
  </div>
);

const EmptySearch = () => (
  <div className={styles.emptyState}>
    <div className={styles.emptyIllustration}>🔍</div>
    <h3>Nothing found</h3>
    <p>Try changing your search parameters or filters</p>
  </div>
);

export default SearchResultsSearch;
