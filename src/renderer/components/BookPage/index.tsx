import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
  FiExternalLink,
  FiGrid,
  FiMaximize2,
} from "react-icons/fi";
import { FaHeart } from "react-icons/fa";
import SmartImage from "../SmartImage";
import { motion, AnimatePresence } from "framer-motion";
import { useTagFilter } from "../../../context/TagFilterContext";

interface Tag {
  id: number;
  type: string;
  name: string;
  url: string;
}

interface Book {
  id: number;
  title: {
    english: string;
    japanese: string;
    pretty: string;
  };
  uploaded: string;
  media: number;
  favorites: number;
  pagesCount: number;
  scanlator: string;
  tags: Tag[];
  cover: string;
  thumbnail: string;
  pages: {
    page: number;
    url: string;
    urlThumb: string;
  }[];
}

const TAG_COLORS: Record<string, string> = {
  language: "#FF7D7F",
  artist: "#FB8DF4",
  character: "#F3E17F",
  parody: "#BCEA83",
  group: "#86F0C6",
  category: "#92EFFF",
  tag: "#A1A1C3",
};

const BookPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedTags, setSelectedTags } = useTagFilter();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);

  const sortedTags = useMemo(() => {
    if (!book || !book.tags) return [];

    const categories = [
      { type: "artist", filter: (t: Tag) => t.type === "artist" },
      { type: "character", filter: (t: Tag) => t.type === "character" },
      { type: "parody", filter: (t: Tag) => t.type === "parody" },
      { type: "group", filter: (t: Tag) => t.type === "group" },
      { type: "category", filter: (t: Tag) => t.type === "category" },
      { type: "tag", filter: () => true },
    ];

    return categories.reduce((acc, { type, filter }) => {
      const bucket = book.tags.filter(filter);
      if (bucket.length) acc.push({ type, tags: bucket });
      return acc;
    }, [] as { type: string; tags: Tag[] }[]);
  }, [book]);

  useEffect(() => {
    const storedFavorites = localStorage.getItem("bookFavorites");
    if (storedFavorites) setFavorites(JSON.parse(storedFavorites));

    const unsubscribe = wsClient.subscribe((response) => {
      if (response.type === "book-reply") {
        setBook(response.book);
        setLoading(false);
      } else if (response.type === "error") {
        setError(response.message || "Не удалось загрузить книгу");
        setLoading(false);
      }
    });

    wsClient.send({ type: "get-book", id: parseInt(id || "0") });
    return () => unsubscribe();
  }, [id]);

  const toggleFavorite = useCallback(() => {
    if (!book) return;
    const newFavorites = favorites.includes(book.id)
      ? favorites.filter((favId) => favId !== book.id)
      : [...favorites, book.id];
    setFavorites(newFavorites);
    localStorage.setItem("bookFavorites", JSON.stringify(newFavorites));
  }, [book, favorites]);

  const handleTagClick = useCallback(
    (tag: Tag) => {
      const normalized = {
        ...tag,
        id: String(tag.id),
        name: tag.name.trim().replace(/\s+/g, " "),
        url: tag.url.startsWith("/")
          ? `https://nhentai.net${tag.url}`
          : tag.url,
        count: typeof (tag as any).count === "number" ? (tag as any).count : 0,
      };

      const existingIndex = selectedTags.findIndex(
        (t) =>
          Number(t.id) === Number(tag.id) && t.name.trim() === tag.name.trim()
      );

      const newTags = [...selectedTags];
      if (existingIndex >= 0) {
        newTags.splice(existingIndex, 1);
      } else {
        newTags.push(normalized);
      }
      setSelectedTags(newTags);
    },
    [selectedTags, setSelectedTags]
  );

  const openImageModal = useCallback((index: number) => {
    setSelectedImage(index);
    setShowModal(true);
    document.body.style.overflow = "hidden";
    setDirection(1);
  }, []);

  const closeImageModal = useCallback(() => {
    setShowModal(false);
    document.body.style.overflow = "auto";
  }, []);

  const navigateImage = useCallback(
    (dir: "prev" | "next") => {
      setSelectedImage((prev) => {
        if (prev === null || !book) return prev;
        const newIdx = dir === "prev" ? prev - 1 : prev + 1;
        setDirection(dir === "prev" ? -1 : 1);
        return Math.max(0, Math.min(book.pages.length - 1, newIdx));
      });
    },
    [book]
  );

  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigateImage("prev");
      if (e.key === "ArrowRight") navigateImage("next");
      if (e.key === "Escape") closeImageModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModal, navigateImage, closeImageModal]);

  if (loading)
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Загрузка книги...</p>
      </div>
    );

  if (error || !book)
    return (
      <div className={styles.errorContainer}>
        <div className={styles.error}>{error || "Книга не найдена"}</div>
        <button onClick={() => navigate(-1)} className={styles.backButton}>
          Вернуться назад
        </button>
      </div>
    );

  const isFavorite = favorites.includes(book.id);
  const title =
    book.title.pretty || book.title.english || book.title.japanese;

  const imageVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.96,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.25 },
      },
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.96,
      transition: { opacity: { duration: 0.15 } },
    }),
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button onClick={() => navigate(-1)} className={styles.backButton}>
          <FiChevronLeft /> Назад
        </button>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.actions}>
          <button
            onClick={toggleFavorite}
            className={`${styles.actionButton} ${
              isFavorite ? styles.favorite : ""
            }`}
            aria-label={
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
            aria-label="Открыть оригинал"
          >
            <FiExternalLink />
          </button>
        </div>
      </header>

      {/* Book Info Section */}
      <section className={styles.bookInfo}>
        <div className={styles.coverContainer}>
          <SmartImage
            src={book.cover || book.thumbnail}
            alt="Обложка"
            className={styles.cover}
          />
        </div>

        <div className={styles.metaData}>
          <div className={styles.metaRow}>
            <div className={styles.metaItem}>
              <FiCalendar className={styles.metaIcon} />
              <span>{new Date(book.uploaded).toLocaleDateString("ru-RU")}</span>
            </div>
            <div className={styles.metaItem}>
              <FiBookOpen className={styles.metaIcon} />
              <span>{book.pagesCount} страниц</span>
            </div>
            <div className={styles.metaItem}>
              <FiHeart className={styles.metaIcon} />
              <span>{book.favorites.toLocaleString()}</span>
            </div>
          </div>

          {book.scanlator && (
            <div className={styles.scanlator}>
              <span>Сканлейтер: {book.scanlator}</span>
            </div>
          )}

          <div className={styles.tagsSection}>
            {sortedTags.map(({ type, tags }) => (
              <div key={type} className={styles.tagGroup}>
                <h3 className={styles.tagGroupTitle}>{type}</h3>
                <div className={styles.tagList}>
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      className={styles.tag}
                      style={{
                        backgroundColor: TAG_COLORS[type] || TAG_COLORS.tag,
                        border: selectedTags.some(
                          (t) =>
                            Number(t.id) === Number(tag.id) &&
                            t.name.trim() === tag.name.trim()
                        )
                          ? "1px solid white"
                          : "none",
                      }}
                      onClick={() => handleTagClick(tag)}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className={styles.gallerySection}>
        <div className={styles.galleryHeader}>
          <h2>
            <FiGrid /> Галерея
          </h2>
          <div className={styles.galleryStats}>
            {book.pagesCount} страниц • {book.media.toLocaleString()} просмотров
          </div>
        </div>

        <div className={styles.galleryGrid}>
          {book.pages.map((page, idx) => (
            <div
              key={idx}
              className={styles.galleryItem}
              onClick={() => openImageModal(idx)}
            >
              <SmartImage
                src={page.urlThumb || page.url}
                alt={`Страница ${idx + 1}`}
                className={styles.thumbnail}
                loading="lazy"
              />
              <div className={styles.pageBadge}>{idx + 1}</div>
              <div className={styles.hoverOverlay}>
                <FiMaximize2 size={16} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Image Modal */}
      <AnimatePresence>
        {showModal && selectedImage !== null && (
          <motion.div
            className={styles.modalOverlay}
            onClick={closeImageModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
            >
              <button
                className={styles.closeButton}
                onClick={closeImageModal}
                aria-label="Закрыть"
              >
                <FiX />
              </button>

              <div className={styles.imageViewer}>
                <button
                  className={`${styles.navButton} ${styles.prevButton}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateImage("prev");
                  }}
                  disabled={selectedImage === 0}
                  aria-label="Предыдущее изображение"
                >
                  <FiChevronLeft />
                </button>

                <div className={styles.imageContainer}>
                  <AnimatePresence custom={direction}>
                    <motion.div
                      key={selectedImage}
                      custom={direction}
                      variants={imageVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className={styles.animatedImage}
                    >
                      <SmartImage
                        src={book.pages[selectedImage].url}
                        alt={`Страница ${selectedImage + 1}`}
                        className={styles.modalImage}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>

                <button
                  className={`${styles.navButton} ${styles.nextButton}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateImage("next");
                  }}
                  disabled={selectedImage === book.pages.length - 1}
                  aria-label="Следующее изображение"
                >
                  <FiChevronRight />
                </button>
              </div>

              <div className={styles.footer}>
                <span className={styles.pageIndicator}>
                  Страница {selectedImage + 1} из {book.pages.length}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BookPage;