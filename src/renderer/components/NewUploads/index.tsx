import React, { useEffect, useState } from "react";
import * as styles from "../pages.module.scss";
import BookCard from "../BookCard";
import { Book } from "../BookCard";
import { FiClock, FiRefreshCw } from "react-icons/fi";
import { wsClient } from "../../../wsClient";

interface NewUploadsResponse {
  type: string;
  books?: Book[];
  message?: string;
}

const BOOKS_PER_PAGE = 12;

const NewUploads: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [page, setPage] = useState(1);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      wsClient.send({ type: 'get-new-uploads' });
      const unsubscribe = wsClient.subscribe((response: NewUploadsResponse) => {
        if (response.type === 'new-uploads-reply') {
          setBooks(response.books || []);
          setLoading(false);
          setPage(1); // Сбросить на первую страницу при обновлении
          unsubscribe();
        } else if (response.type === 'error') {
          setError(response.message || 'Unknown error');
          setLoading(false);
          unsubscribe();
        }
      });
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleFavorite = (id: number) => {
    const newFavorites = favorites.includes(id)
      ? favorites.filter(favId => favId !== id)
      : [...favorites, id];
    setFavorites(newFavorites);
    localStorage.setItem("bookFavorites", JSON.stringify(newFavorites));
  };

  // Пагинация
  const totalPages = Math.ceil(books.length / BOOKS_PER_PAGE);
  const paginatedBooks = books.slice(
    (page - 1) * BOOKS_PER_PAGE,
    page * BOOKS_PER_PAGE
  );

  const handlePrev = () => setPage(p => Math.max(1, p - 1));
  const handleNext = () => setPage(p => Math.min(totalPages, p + 1));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>
          <FiClock /> Новые загрузки
          <button onClick={fetchData} disabled={loading}>
            <FiRefreshCw className={loading ? styles.spin : ''} />
          </button>
        </h2>
      </div>

      {error ? (
        <div className={styles.error}>
          Ошибка: {error}
          <button onClick={fetchData}>Повторить</button>
        </div>
      ) : loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : books.length === 0 ? (
        <div className={styles.empty}>Нет новых загрузок</div>
      ) : (
        <>
          <div className={styles.grid}>
            {paginatedBooks.map(book => (
              <BookCard
                key={book.id}
                book={book}
                isFavorite={favorites.includes(book.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
          <div className={styles.pagination}>
            <button onClick={handlePrev} disabled={page === 1}>
              Назад
            </button>
            <span>
              Страница {page} из {totalPages}
            </span>
            <button onClick={handleNext} disabled={page === totalPages}>
              Вперёд
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default NewUploads;