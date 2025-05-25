import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { wsClient } from "../../../wsClient";
import * as styles from "./BookPage.module.scss";
import {
  FiHeart,
  FiBookOpen,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiDownload,
  FiExternalLink,
} from "react-icons/fi";
import { FaHeart } from "react-icons/fa";
import SmartImage from "../SmartImage";

interface Tag {
  id: number;
  type: string;
  name: string;
}

interface Book {
  id: number;
  title: {
    english: string;
    japanese: string;
    pretty: string;
  };
  uploaded: string;
  media: string;
  favorites: number;
  pagesCount: number;
  scanlator: string;
  tags: Tag[];
  cover: string;
  thumbnail: string;
  pages: {
    page: number;
    url: string;
  }[];
}

const BookPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<"single" | "double">("single");
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const storedFavorites = localStorage.getItem("bookFavorites");
    if (storedFavorites) {
      setFavorites(JSON.parse(storedFavorites));
    }

    const unsubscribe = wsClient.subscribe((response) => {
      if (response.type === "book-reply") {
        setBook(response.book);
        setLoading(false);
      } else if (response.type === "error") {
        setError(response.message || "Не удалось загрузить книгу");
        setLoading(false);
      }
    });

    wsClient.send({
      type: "get-book",
      id: parseInt(id || "0"),
    });

    return () => {
      unsubscribe();
    };
  }, [id]);

  const toggleFavorite = () => {
    if (!book) return;
    const newFavorites = favorites.includes(book.id)
      ? favorites.filter((favId) => favId !== book.id)
      : [...favorites, book.id];
    setFavorites(newFavorites);
    localStorage.setItem("bookFavorites", JSON.stringify(newFavorites));
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) =>
      Math.max(0, prev - (viewMode === "single" ? 1 : 2))
    );
  };

  const handleNextPage = () => {
    if (!book) return;
    setCurrentPage((prev) => {
      const maxPage =
        viewMode === "single"
          ? book.pagesCount - 1
          : Math.floor(book.pagesCount / 2) * 2 - 2;
      return Math.min(maxPage, prev + (viewMode === "single" ? 1 : 2));
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!book) return;
    switch (e.key) {
      case "ArrowLeft":
        handlePrevPage();
        break;
      case "ArrowRight":
        handleNextPage();
        break;
      case "Escape":
        navigate(-1);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [book, viewMode]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Загрузка книги...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.error}>{error}</div>
        <button onClick={() => navigate(-1)} className={styles.backButton}>
          Вернуться назад
        </button>
      </div>
    );
  }

  if (!book) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.error}>Книга не найдена</div>
        <button onClick={() => navigate(-1)} className={styles.backButton}>
          Вернуться назад
        </button>
      </div>
    );
  }

  const isFavorite = favorites.includes(book.id);
  const pagesToShow =
    viewMode === "single"
      ? [currentPage]
      : [currentPage, currentPage + 1].filter((p) => p < book.pagesCount);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => navigate(-1)} className={styles.backButton}>
          <FiChevronLeft /> Назад
        </button>

        <h1 className={styles.title}>
          {book.title.pretty || book.title.english || book.title.japanese}
        </h1>

        <div className={styles.actions}>
          <button
            onClick={toggleFavorite}
            className={`${styles.actionButton} ${
              isFavorite ? styles.favorite : ""
            }`}
            title={
              isFavorite ? "Удалить из избранного" : "Добавить в избранное"
            }
          >
            {isFavorite ? <FaHeart /> : <FiHeart />}
          </button>

          <button
            onClick={() =>
              window.open(`https://nhentai.net/g/${book.id}`, "_blank")
            }
            className={styles.actionButton}
            title="Открыть на nhentai.net"
          >
            <FiExternalLink />
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.sidebar}>
          <div className={styles.coverContainer}>
            <SmartImage
              src={book.cover || book.thumbnail}
              alt="Обложка"
              className={styles.cover}
            />
          </div>

          <div className={styles.meta}>
            <div className={styles.metaItem}>
              <FiCalendar className={styles.metaIcon} />
              <span>{new Date(book.uploaded).toLocaleDateString()}</span>
            </div>

            <div className={styles.metaItem}>
              <FiBookOpen className={styles.metaIcon} />
              <span>{book.pagesCount} страниц</span>
            </div>

            <div className={styles.metaItem}>
              <FiHeart className={styles.metaIcon} />
              <span>{book.favorites} лайков</span>
            </div>

            {book.scanlator && (
              <div className={styles.metaItem}>
                <span>Сканлейтер: {book.scanlator}</span>
              </div>
            )}
          </div>

          <div className={styles.tags}>
            <h3>Теги:</h3>
            <div className={styles.tagList}>
              {book.tags.map((tag) => (
                <span key={tag.id} className={styles.tag}>
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.reader}>
          <div className={styles.readerControls}>
            <div className={styles.zoomControls}>
              <button
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                disabled={zoom <= 0.5}
              >
                -
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                disabled={zoom >= 2}
              >
                +
              </button>
            </div>

            <div className={styles.viewMode}>
              <button
                onClick={() => setViewMode("single")}
                className={viewMode === "single" ? styles.active : ""}
              >
                Одностраничный
              </button>
              <button
                onClick={() => setViewMode("double")}
                className={viewMode === "double" ? styles.active : ""}
              >
                Двухстраничный
              </button>
            </div>

            <div className={styles.pageInfo}>
              Страница {currentPage + 1} из {book.pagesCount}
            </div>
          </div>

          <div className={styles.pagesContainer}>
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 0}
              className={styles.navButton}
            >
              <FiChevronLeft />
            </button>

            <div className={styles.pages}>
              {pagesToShow.map((pageIndex) => (
                <div
                  key={pageIndex}
                  className={styles.pageWrapper}
                  style={{ transform: `scale(${zoom})` }}
                >
                  <SmartImage
                    src={book.pages[pageIndex].url}
                    alt={`Страница ${pageIndex + 1}`}
                    className={styles.pageImage}
                  />
                  <div className={styles.pageNumber}>{pageIndex + 1}</div>
                </div>
              ))}
            </div>

            <button
              onClick={handleNextPage}
              disabled={
                currentPage >= book.pagesCount - (viewMode === "single" ? 1 : 2)
              }
              className={styles.navButton}
            >
              <FiChevronRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookPage;
