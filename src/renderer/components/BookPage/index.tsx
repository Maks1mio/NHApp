import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { wsClient } from "../../../wsClient";
import * as styles from "./BookPage.module.scss";
import {
  FiHeart, FiBookOpen, FiCalendar,
  FiChevronLeft, FiChevronRight, FiX, FiExternalLink, FiGrid, FiMaximize2
} from "react-icons/fi";
import { FaHeart } from "react-icons/fa";
import SmartImage from "../SmartImage";
import { motion, AnimatePresence } from "framer-motion";

interface Tag {
  id: number;
  type: string;
  name: string;
}
interface Book {
  id: number;
  title: { english: string; japanese: string; pretty: string; };
  uploaded: string;
  media: string;
  favorites: number;
  pagesCount: number;
  scanlator: string;
  tags: Tag[];
  cover: string;
  thumbnail: string;
  pages: { page: number; url: string; urlThumb: string; }[];
}

const preloadImage = (url: string) => {
  const img = new window.Image();
  img.src = url;
};

const BookPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Для предотвращения багов с анимацией
  const prevIndex = useRef<number | null>(null);

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

  // Управление избранным
  const toggleFavorite = useCallback(() => {
    if (!book) return;
    const newFavorites = favorites.includes(book.id)
      ? favorites.filter((favId) => favId !== book.id)
      : [...favorites, book.id];
    setFavorites(newFavorites);
    localStorage.setItem("bookFavorites", JSON.stringify(newFavorites));
  }, [book, favorites]);

  // Модалка
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

  // Перелистывание
  const navigateImage = useCallback((direction: "prev" | "next") => {
    setSelectedImage((prev) => {
      if (prev === null || !book) return prev;
      let newIdx = prev;
      if (direction === "prev" && prev > 0) {
        newIdx = prev - 1;
        setDirection(-1);
      } else if (direction === "next" && prev < book.pages.length - 1) {
        newIdx = prev + 1;
        setDirection(1);
      }
      return newIdx;
    });
  }, [book]);

  // Клавиши
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

  // Предзагрузка картинок
  useEffect(() => {
    if (!book || selectedImage == null) return;
    // Загружаем до двух следующих и до двух предыдущих
    const urlsToPreload = [];
    for (let offset = -2; offset <= 2; offset++) {
      if (offset === 0) continue;
      const idx = selectedImage + offset;
      if (idx >= 0 && idx < book.pages.length) {
        urlsToPreload.push(book.pages[idx].url);
      }
    }
    urlsToPreload.forEach(preloadImage);
  }, [book, selectedImage]);

  if (loading) return (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingSpinner}></div>
      <p>Загрузка книги...</p>
    </div>
  );
  if (error || !book) return (
    <div className={styles.errorContainer}>
      <div className={styles.error}>{error || "Книга не найдена"}</div>
      <button onClick={() => navigate(-1)} className={styles.backButton}>Вернуться назад</button>
    </div>
  );

  const isFavorite = favorites.includes(book.id);
  const title = book.title.pretty || book.title.english || book.title.japanese;

  // Для анимации слайдера
  const imageVariants = {
    enter: (direction: 1 | -1) => ({
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
      }
    },
    exit: (direction: 1 | -1) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.96,
      transition: { opacity: { duration: 0.15 } }
    })
  };

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <button onClick={() => navigate(-1)} className={styles.backButton}><FiChevronLeft /> Назад</button>
        <h1 className={styles.title} title={title}>{title}</h1>
        <div className={styles.actions}>
          <button
            onClick={toggleFavorite}
            className={`${styles.actionButton} ${isFavorite ? styles.favorite : ''}`}
            title={isFavorite ? "Удалить из избранного" : "Добавить в избранное"}>
            {isFavorite ? <FaHeart /> : <FiHeart />}
          </button>
          <button
            onClick={() => window.open(`https://nhentai.net/g/${book.id}`, "_blank")}
            className={styles.actionButton} title="Открыть на nhentai.net">
            <FiExternalLink />
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <main className={styles.content}>
        {/* Info Panel */}
        <aside className={styles.infoPanel}>
          <div className={styles.coverContainer}>
            <SmartImage src={book.cover || book.thumbnail} alt="Обложка" className={styles.cover} />
          </div>
          <div className={styles.meta}>
            <div className={styles.metaItem}><FiCalendar className={styles.metaIcon} /> <span>{new Date(book.uploaded).toLocaleDateString()}</span></div>
            <div className={styles.metaItem}><FiBookOpen className={styles.metaIcon} /> <span>{book.pagesCount} страниц</span></div>
            <div className={styles.metaItem}><FiHeart className={styles.metaIcon} /> <span>{book.favorites.toLocaleString()} лайков</span></div>
            {book.scanlator && <div className={styles.metaItem}><span>Сканлейтер: {book.scanlator}</span></div>}
          </div>
          <div className={styles.tags}>
            <h3>Теги:</h3>
            <div className={styles.tagList}>
              {book.tags.map((tag) => <span key={tag.id} className={styles.tag} data-type={tag.type}>{tag.name}</span>)}
            </div>
          </div>
        </aside>

        {/* Gallery */}
        <section className={styles.gallery}>
          <div className={styles.galleryHeader}>
            <h2><FiGrid /> Галерея</h2>
          </div>
          <div className={styles.galleryGrid}>
            {book.pages.map((page, idx) => (
              <div key={idx} className={styles.galleryItem} onClick={() => openImageModal(idx)}>
                <SmartImage src={page.urlThumb || page.url} alt={`Страница ${idx + 1}`} className={styles.thumbnail} loading="lazy" />
                <div className={styles.pageNumber}>{idx + 1}</div>
                <div className={styles.zoomIndicator}><FiMaximize2 size={14} /></div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* MODAL */}
      <AnimatePresence>
        {showModal && selectedImage !== null && (
          <motion.div className={styles.modalOverlay}
            onClick={closeImageModal}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={styles.modalContent}
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 250, damping: 30 }}>
              <button className={styles.closeButton} onClick={closeImageModal}><FiX /></button>
              <div className={styles.modalImageContainer}>
                <button className={`${styles.navButton} ${styles.prevButton}`}
                  onClick={e => { e.stopPropagation(); navigateImage("prev"); }}
                  disabled={selectedImage === 0}><FiChevronLeft /></button>
                <div className={styles.modalSlideContainer}>
                  <AnimatePresence initial={false} custom={direction}>
                    <motion.div
                      key={selectedImage}
                      className={styles.modalImageMotion}
                      custom={direction}
                      variants={imageVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.35, type: "tween" }}
                      style={{ position: "absolute", width: "100%" }}
                    >
                      <SmartImage
                        src={book.pages[selectedImage].url}
                        alt={`Страница ${selectedImage + 1}`}
                        className={styles.modalImage}
                        // style={{ userSelect: "none", pointerEvents: "none" }}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
                <button className={`${styles.navButton} ${styles.nextButton}`}
                  onClick={e => { e.stopPropagation(); navigateImage("next"); }}
                  disabled={selectedImage === book.pages.length - 1}><FiChevronRight /></button>
              </div>
              <div className={styles.modalFooter}>
                <span className={styles.modalPageInfo}>
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
