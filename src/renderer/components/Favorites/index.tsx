import React, { useEffect, useState } from "react";
import BookCard from "../BookCard";
import { Book } from "../BookCard";
import { FiHeart, FiRefreshCw } from "react-icons/fi";
import * as styles from "../pages.module.scss";
import { wsClient } from "../../../wsClient";
import Pagination from "../Pagination";

const PER_PAGE = 25;

interface FavoritesResponse {
  type: string;
  books?: Book[];
  message?: string;
}

const Favorites: React.FC = () => {
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [displayBooks, setDisplayBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(allBooks.length / PER_PAGE) || 1;

  const fetchData = () => {
    setLoading(true);
    setError(null);

    const favsRaw = localStorage.getItem("bookFavorites");
    const favIds: number[] = favsRaw ? JSON.parse(favsRaw) : [];
    setFavorites(favIds);

    if (favIds.length === 0) {
      setAllBooks([]);
      setLoading(false);
      return;
    }

    wsClient.send({ type: "get-favorites", ids: favIds });
    const unsubscribe = wsClient.subscribe((res: FavoritesResponse) => {
      if (res.type === "favorites-reply") {
        setAllBooks(res.books || []);
      } else if (res.type === "error") {
        setError(res.message || "Unknown error");
      }
      setLoading(false);
      unsubscribe();
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // update the displayed slice when changing page or book set
    const start = (currentPage - 1) * PER_PAGE;
    setDisplayBooks(allBooks.slice(start, start + PER_PAGE));
  }, [allBooks, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const toggleFavorite = (id: number) => {
    const next = favorites.includes(id)
      ? favorites.filter((f) => f !== id)
      : [...favorites, id];
    setFavorites(next);
    localStorage.setItem("bookFavorites", JSON.stringify(next));
    // immediately remove from display if removing
    setAllBooks((prev) => prev.filter((b) => next.includes(b.id)));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.mainTitle}>
          <FiHeart className={styles.icon} />
          Favorites
        </h1>
        <button
          onClick={fetchData}
          disabled={loading}
          className={styles.reloadBtn}
          aria-label="Refresh"
        >
          <FiRefreshCw
            className={`${styles.reloadIcon} ${loading ? styles.spin : ""}`}
          />
          Refresh
        </button>
      </div>

      <div className={styles.content}>
        {error && (
          <div className={styles.error}>
            Error: {error}
            <button onClick={fetchData} className={styles.retryBtn}>
              Retry
            </button>
          </div>
        )}
        {loading && (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
            Loading...
          </div>
        )}
        {!loading && allBooks.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>💔</div>
            No favorite books
          </div>
        )}
        {!loading && displayBooks.length > 0 && (
          <>
            <div className={styles.grid}>
              {displayBooks.map((book) => (
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

export default Favorites;
