import React, { useCallback, useEffect, useState } from "react";
import BookCard, { Book } from "../BookCard";
import Pagination from "../Pagination";
import { FiStar, FiTrendingUp } from "react-icons/fi";
import { FaRedo } from "react-icons/fa";
import * as styles from "./SearchResults.module.scss";
import { wsClient } from "../../../wsClient";

const PER_PAGE = 25; // Adjusted to match other components
const FAVORITES_SORT_KEY = "favoritesSortType";
const LS_FAVORITES_KEY = "bookFavorites";

type SortType = "relevance" | "popular";

const SORT_OPTS: { value: SortType; label: string; icon: React.ReactNode }[] = [
  { value: "relevance", label: "By date added", icon: <FiStar /> },
  { value: "popular", label: "By popularity", icon: <FiTrendingUp /> },
];

const SearchResultsFavorites: React.FC = () => {
  const [favIds, setFavIds] = useState<number[]>(() =>
    JSON.parse(localStorage.getItem(LS_FAVORITES_KEY) ?? "[]")
  );

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const initialSort =
    (localStorage.getItem(FAVORITES_SORT_KEY) as SortType) || "relevance";
  const [sortState, setSortState] = useState<SortType>(initialSort);

  useEffect(() => {
    const h = (e: StorageEvent) => {
      if (e.key === LS_FAVORITES_KEY) {
        const next = JSON.parse(e.newValue ?? "[]");
        setFavIds(next);
      }
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, []);

  const fetchData = useCallback(
    (p = 1, s: SortType = sortState) => {
      if (favIds.length === 0) {
        setBooks([]);
        setTotalPages(1);
        setCurrentPage(1);
        return;
      }
      setLoading(true);
      setError(null);
      setCurrentPage(p);

      const unsub = wsClient.subscribe((res) => {
        if (res.type === "error") {
          setError(res.message || "Unknown error");
          setLoading(false);
          return unsub();
        }
        if (res.type === "favorites-reply") {
          setBooks(res.books || []);
          setTotalPages(res.totalPages ?? 1);
          setCurrentPage(res.currentPage ?? p);
          setLoading(false);
          unsub();
        }
      });

      wsClient.send({
        type: "get-favorites",
        ids: favIds,
        page: p,
        perPage: PER_PAGE,
        sort: s === "popular" ? "popular" : "relevance",
      });
    },
    [favIds, sortState]
  );

  // Initial fetch on mount
  useEffect(() => {
    fetchData(1, initialSort);
  }, [initialSort, fetchData]);

  // Handle sort changes
  useEffect(() => {
    fetchData(currentPage, sortState);
  }, [sortState]);

  const onSort = (s: SortType) => {
    if (s === sortState) return;
    localStorage.setItem(FAVORITES_SORT_KEY, s);
    setSortState(s);
    fetchData(currentPage, s);
  };

  const onPageChange = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
    fetchData(p, sortState);
  };

  const toggleFavorite = (id: number, add: boolean) => {
    setFavIds((prev) => {
      const next = add ? [...prev, id] : prev.filter((i) => i !== id);
      localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(next));
      if (!add) setBooks((b) => b.filter((book) => book.id !== id));
      return next;
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.minimalHeader}>
        <div className={styles.sortControls}>
          {SORT_OPTS.map((o) => (
            <button
              key={o.value}
              className={`${styles.sortButton} ${
                sortState === o.value ? styles.active : ""
              }`}
              disabled={favIds.length === 0}
              onClick={() => onSort(o.value)}
            >
              {o.icon}
              <span>{o.label}</span>
            </button>
          ))}
          <button
            className={styles.refreshButton}
            disabled={loading || favIds.length === 0}
            onClick={() => fetchData(currentPage, sortState)}
          >
            <FaRedo
              className={`${styles.refreshIcon} ${loading ? styles.spin : ""}`}
            />
          </button>
        </div>
      </div>

      <div className={styles.mainContent}>
        {error && <Error msg={error} retry={() => fetchData(currentPage, sortState)} />}
        {loading && <Loading />}
        {!loading && favIds.length === 0 && <EmptyFav />}
        {!loading && favIds.length > 0 && books.length === 0 && <EmptyRes />}

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

const Loading = () => (
  <div className={styles.loadingState}>
    <div className={styles.loadingSpinner} />
  </div>
);

const Error: React.FC<{ msg: string; retry: () => void }> = ({
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

const EmptyFav = () => (
  <div className={styles.emptyState}>
    <div className={styles.emptyIllustration}>📚</div>
    <h3>Your favorites are empty</h3>
    <p>Save the works you like, and they will appear here</p>
  </div>
);

const EmptyRes = () => (
  <div className={styles.emptyState}>
    <div className={styles.emptyIllustration}>🔍</div>
    <h3>Nothing found</h3>
    <p>Try changing the sort or filters</p>
  </div>
);

export default SearchResultsFavorites;