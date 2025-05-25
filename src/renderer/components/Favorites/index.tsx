import React, { useEffect, useState } from "react";
import BookCard from "../BookCard";
import { Book } from "../BookCard";
import { FiHeart, FiRefreshCw } from "react-icons/fi";
import * as styles from "../pages.module.scss";
// import * as f from "./Favorites.module.scss";

const WS_URL = "ws://localhost:8080";

const Favorites: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    setBooks([]);

    const favsRaw = localStorage.getItem("bookFavorites");
    const favIds: number[] = favsRaw ? JSON.parse(favsRaw) : [];

    if (favIds.length === 0) {
      setLoading(false);
      return;
    }

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "get-favorites",
          ids: favIds,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const res = JSON.parse(event.data) as {
          type: string;
          books?: Book[];
          message?: string;
        };

        if (res.type === "favorites-reply") {
          setBooks(res.books || []);
        } else if (res.type === "error") {
          setError(res.message || "Unknown error");
        }
      } catch {
        setError("Invalid response from server");
      } finally {
        setLoading(false);
        ws.close();
      }
    };

    ws.onerror = () => {
      setError("Connection error");
      setLoading(false);
      ws.close();
    };
  };

  useEffect(() => {
    const favsRaw = localStorage.getItem("bookFavorites");
    if (favsRaw) setFavorites(JSON.parse(favsRaw));
    fetchData();
  }, []);

  const toggleFavorite = (id: number) => {
    const next = favorites.includes(id)
      ? favorites.filter((f) => f !== id)
      : [...favorites, id];
    setFavorites(next);
    localStorage.setItem("bookFavorites", JSON.stringify(next));
    // тут обновляем отображаемый список
    setBooks((prev) => prev.filter((b) => next.includes(b.id)));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.mainTitle}>
          <FiHeart className={styles.icon} />
          Избранное
        </h1>
        <button
          onClick={fetchData}
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

      <div className={styles.content}>
        {error ? (
          <div className={styles.error}>
            Ошибка: {error}
            <button
              onClick={fetchData}
              className={styles.retryBtn}
            >
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
            <div className={styles.emptyIcon}>💔</div>
            Нет избранных книг
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

export default Favorites;
