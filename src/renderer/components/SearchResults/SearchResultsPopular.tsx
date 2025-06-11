import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import BookCard, { Book } from "../BookCard";
import Pagination from "../Pagination";
import { FiClock, FiTrendingUp } from "react-icons/fi";
import { FaRedo } from "react-icons/fa";
import * as styles from "./SearchResults.module.scss";
import { wsClient } from "../../../wsClient";
import { useTagFilter } from "../../../context/TagFilterContext";

const PER_PAGE = 25;
const POPULAR_SORT_STORAGE_KEY = "popularBooksSortType";
const LS_FAVORITES_KEY = "bookFavorites";

type SortType = "popular" | "popular-week" | "popular-today" | "popular-month";

const SORT_OPTS: { value: SortType; label: string; icon: React.ReactNode }[] = [
  { value: "popular", label: "Popular (all time)", icon: <FiTrendingUp /> },
  { value: "popular-week", label: "Popular (week)", icon: <FiClock /> },
  { value: "popular-today", label: "Popular (today)", icon: <FiClock /> },
  { value: "popular-month", label: "Popular (month)", icon: <FiClock /> },
];

const SearchResultsPopular: React.FC = () => {
  const { search } = useLocation();
  const navigate = useNavigate();
  const qp = new URLSearchParams(search);
  const sortURL = qp.get("sort") as SortType | null;

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

  const toggleFavorite = (id: number, add: boolean) => {
    setFavIds((prev) => {
      const next = add ? [...prev, id] : prev.filter((i) => i !== id);
      localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  };

  const initialSort: SortType =
    sortURL && SORT_OPTS.some((o) => o.value === sortURL)
      ? sortURL
      : (localStorage.getItem(POPULAR_SORT_STORAGE_KEY) as SortType) ||
        "popular";

  const [sortState, setSort] = useState<SortType>(initialSort);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoad] = useState(false);
  const [error, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotal] = useState(1);

  const fetchData = useCallback(
    (p = 1, s: SortType = sortState) => {
      setLoad(true);
      setErr(null);

      const unsub = wsClient.subscribe((res) => {
        if (res.type === "error") {
          setErr(res.message || "Unknown error");
          setLoad(false);
          return unsub();
        }
        if (res.type === "popular-books-reply") {
          setBooks(res.books || []);
          setTotal(res.totalPages ?? 1);
          setPage(res.currentPage ?? 1);
          setLoad(false);
          unsub();
        }
      });

      wsClient.send({
        type: "search-books",
        query: "",
        sort: s,
        page: p,
        perPage: PER_PAGE,
        filterTags: selectedTags,
        contentType: "popular",
      });
    },
    [selectedTags, sortState]
  );

  useEffect(() => {
    fetchData(1, initialSort);
  }, []);
  useEffect(() => {
    fetchData(1, sortState);
  }, [selectedTags]);

  const onSort = (s: SortType) => {
    if (s === sortState) return;
    localStorage.setItem(POPULAR_SORT_STORAGE_KEY, s);
    navigate(`/search?type=popular&sort=${s}`);
    setSort(s);
    fetchData(1, s);
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
              onClick={() => onSort(o.value)}
            >
              {o.icon}
              <span>{o.label}</span>
            </button>
          ))}
          <button
            className={styles.refreshButton}
            disabled={loading}
            onClick={() => fetchData(page, sortState)}
          >
            <FaRedo
              className={`${styles.refreshIcon} ${loading ? styles.spin : ""}`}
            />
          </button>
        </div>
      </div>

      <div className={styles.mainContent}>
        {error && (
          <ErrorBlock msg={error} retry={() => fetchData(page, sortState)} />
        )}
        {loading && <LoadingBlock />}
        {!loading && books.length === 0 && <EmptyBlock />}

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
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={(p) => fetchData(p, sortState)}
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

const EmptyBlock = () => (
  <div className={styles.emptyState}>
    <div className={styles.emptyIllustration}>📈</div>
    <h3>Empty for now</h3>
    <p>No popular works found — try again later</p>
  </div>
);

export default SearchResultsPopular;
