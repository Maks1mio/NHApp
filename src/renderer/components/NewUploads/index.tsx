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

const NewUploads: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<number[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Используем общий wsClient
      // Замените старый код с ws на wsClient
      // Пример:
      // wsClient.send({ type: 'get-new-uploads' });
      // const unsubscribe = wsClient.subscribe((response) => { ... });

      wsClient.send({ type: 'get-new-uploads' });
      const unsubscribe = wsClient.subscribe((response: NewUploadsResponse) => {
        if (response.type === 'new-uploads-reply') {
          setBooks(response.books || []);
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
      )}
    </div>
  );
};

export default NewUploads;