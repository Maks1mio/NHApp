import React, { useEffect, useState } from "react";
import * as styles from "../pages.module.scss";
import BookCard from "../BookCard";
import { Book } from "../BookCard";
import { FiClock, FiRefreshCw } from "react-icons/fi";
import { wsClient } from "../../../wsClient";
import Pagination from "../Pagination";

interface NewUploadsResponse {
  type: string;
  books?: Book[];
  totalPages?: number;
  currentPage?: number;
  message?: string;
}

const NewUploads: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = async (page: number = currentPage) => {
    try {
      setLoading(true);
      setError(null);
      
      wsClient.send({ type: 'get-new-uploads', page });
      const unsubscribe = wsClient.subscribe((response: NewUploadsResponse) => {
        if (response.type === 'new-uploads-reply') {
          setBooks(response.books || []);
          setTotalPages(response.totalPages || 1);
          setCurrentPage(response.currentPage || 1);
          setLoading(false);
          unsubscribe();
        } else if (response.type === 'error') {
          setError(response.message || 'Unknown error');
          setLoading(false);
          unsubscribe();
        }
      });
    } catch (error: any) {
      setError(error.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData(page);
  };

  const toggleFavorite = (id: number) => {
    const newFavorites = favorites.includes(id)
      ? favorites.filter(favId => favId !== id)
      : [...favorites, id];
    setFavorites(newFavorites);
    localStorage.setItem("bookFavorites", JSON.stringify(newFavorites));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>
          <FiClock /> Новые загрузки
          <button onClick={() => fetchData()} disabled={loading}>
            <FiRefreshCw className={loading ? styles.spin : ''} />
          </button>
        </h2>
      </div>

      {error ? (
        <div className={styles.error}>
          Ошибка: {error}
          <button onClick={() => fetchData()}>Повторить</button>
        </div>
      ) : loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : books.length === 0 ? (
        <div className={styles.empty}>Нет новых загрузок</div>
      ) : (
        <>
          <div className={styles.grid}>
            {books.map(book => (
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
  );
};

export default NewUploads;