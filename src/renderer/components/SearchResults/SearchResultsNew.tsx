import React, { useCallback, useEffect, useState } from "react";
import { FaRedo } from "react-icons/fa";
import { FiUpload } from "react-icons/fi";
import * as styles from "./SearchResults.module.scss";
import BookCard, { Book } from "../BookCard";
import Pagination from "../Pagination";
import { wsClient } from "../../../wsClient";
import { useTagFilter } from "../../../context/TagFilterContext";

const PER_PAGE = 25;
const LS_FAVORITES_KEY = "bookFavorites";

const SearchResultsNew: React.FC = () => {
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

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoad] = useState(false);
  const [error, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotal] = useState(1);

  const fetchData = useCallback(
    (p = 1) => {
      setLoad(true);
      setErr(null);

      const unsub = wsClient.subscribe((res) => {
        if (res.type === "error") {
          setErr(res.message || "Unknown error");
          setLoad(false);
          return unsub();
        }
        if (res.type === "new-uploads-reply") {
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
        sort: "date",
        page: p,
        perPage: PER_PAGE,
        filterTags: selectedTags,
        contentType: "new",
      });
    },
    [selectedTags]
  );

  useEffect(() => {
    fetchData(1);
  }, []);
  useEffect(() => {
    fetchData(1);
  }, [selectedTags]);

  return (
    <div className={styles.container}>
      <div className={styles.minimalHeader}>
        <button
          className={styles.refreshButton}
          disabled={loading}
          onClick={() => fetchData(page)}
        >
          <FaRedo
            className={`${styles.refreshIcon} ${loading ? styles.spin : ""}`}
          />
        </button>
      </div>

      <div className={styles.mainContent}>
        {error && <ErrorBlock msg={error} retry={() => fetchData(page)} />}
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
                  onPageChange={fetchData}
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
    <div className={styles.emptyIllustration}>📂</div>
    <h3>Empty for now</h3>
    <p>No uploads yet — check back later</p>
  </div>
);

export default SearchResultsNew;
