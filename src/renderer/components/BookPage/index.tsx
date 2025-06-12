import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
  FiZoomIn,
  FiZoomOut,
  FiRotateCw,
  FiImage,
  FiCopy,
  FiSearch,
} from "react-icons/fi";
import { FaHeart } from "react-icons/fa";
import SmartImage from "../SmartImage";
import { useTagFilter } from "../../../context/TagFilterContext";
import ReactCountryFlag from "react-country-flag";
import BookCard from "../BookCard";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "../../../hooks/useIsMobile";

interface Tag {
  id: number;
  type: string;
  name: string;
  url: string;
  count: number;
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
  artists?: Tag[];
  characters?: Tag[];
  parodies?: Tag[];
  groups?: Tag[];
  categories?: Tag[];
  languages?: Tag[];
}

const TAG_COLORS: Record<string, string> = {
  language: "#FF7D7F",
  artist: "#FB8DF4",
  character: "#F3E17F",
  parody: "#BCEA83",
  group: "#86F0C6",
  category: "#92EFFF",
  tag: "#98a2af",
};

const languageCountryCodes: Record<string, string> = {
  english: "GB",
  chinese: "CN",
  japanese: "JP",
};

const SUPPORTED_LANGUAGES = Object.keys(languageCountryCodes);

const PRELOAD_COUNT = 5;

const BookPage: React.FC = () => {
  const isMobile = useIsMobile(900);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedTags, setSelectedTags } = useTagFilter();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [relatedBooks, setRelatedBooks] = useState<Book[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(() => {
    const saved = localStorage.getItem("bookZoomLevel");
    return saved ? parseFloat(saved) : 1;
  });
  const [magnifierZoomLevel, setMagnifierZoomLevel] = useState(() => {
    const saved = localStorage.getItem("bookMagnifierZoomLevel");
    return saved ? parseFloat(saved) : 2;
  });
  const [rotation, setRotation] = useState(() => {
    const saved = localStorage.getItem("bookRotation");
    return saved ? parseInt(saved) : 0;
  });
  const [showDoublePage, setShowDoublePage] = useState(() => {
    const saved = localStorage.getItem("bookShowDoublePage");
    return saved ? JSON.parse(saved) : false;
  });
  const [isCopied, setIsCopied] = useState(false);
  const [isMagnifierActive, setIsMagnifierActive] = useState(false);
  const [magnifierPosition, setMagnifierPosition] = useState({ x: 0, y: 0 });
  const [magnifierSize, setMagnifierSize] = useState(() => {
    const saved = localStorage.getItem("bookMagnifierSize");
    return saved ? parseInt(saved) : 150;
  });
  const [showMagnifierHint, setShowMagnifierHint] = useState(false);
  const [hoveredImageIndex, setHoveredImageIndex] = useState<number | null>(
    null
  );
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [magnifierSide, setMagnifierSide] = useState<
    "left" | "right" | "center"
  >("center");
  const [showControlHints, setShowControlHints] = useState(false);

  const imageRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Категории тегов
  const categories = [
    {
      type: "language",
      label: "Языки",
      filter: (t: Tag) => SUPPORTED_LANGUAGES.includes(t.name.toLowerCase()),
    },
    {
      type: "artist",
      label: "Артисты",
      filter: (t: Tag) => t.type === "artist",
    },
    {
      type: "character",
      label: "Персонажи",
      filter: (t: Tag) => t.type === "character",
    },
    {
      type: "parody",
      label: "Пародии",
      filter: (t: Tag) => t.type === "parody",
    },
    { type: "group", label: "Группы", filter: (t: Tag) => t.type === "group" },
    {
      type: "category",
      label: "Категории",
      filter: (t: Tag) => t.type === "category",
    },
    { type: "tag", label: "Теги", filter: () => true },
  ];

  const sortedTags = useMemo(() => {
    if (!book || !book.tags) return [];
    const uniqueTags = book.tags.filter(
      (tag, idx, arr) =>
        idx === arr.findIndex((t) => t.id === tag.id && t.name === tag.name)
    );

    const usedIds = new Set<string>();
    return categories
      .map(({ type, label, filter }) => ({
        type,
        label,
        tags: uniqueTags.filter((t) => {
          const id = String(t.id);
          const pass = !usedIds.has(id) && filter(t);
          if (pass) usedIds.add(id);
          return pass;
        }),
      }))
      .filter((cat) => cat.tags.length > 0);
  }, [book]);

  useEffect(() => {
    const storedFavorites = localStorage.getItem("bookFavorites");
    if (storedFavorites) setFavorites(JSON.parse(storedFavorites));

    const unsubscribe = wsClient.subscribe((response) => {
      if (response.type === "book-reply") {
        setBook(response.book);
        setLoading(false);
        wsClient.send({ type: "get-related-books", id: parseInt(id || "0") });
      } else if (response.type === "related-books-reply") {
        setRelatedBooks(response.books || []);
      } else if (response.type === "error") {
        setError(response.message || "Couldn't load the workbook");
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
        count: typeof tag.count === "number" ? tag.count : 0,
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
  }, []);

  const closeImageModal = useCallback(() => {
    setShowModal(false);
    setIsMagnifierActive(false);
    setShowMagnifierHint(false);
    setShowControlHints(false);
    document.body.style.overflow = "auto";
  }, []);

  const navigateImage = useCallback(
    (dir: "prev" | "next") => {
      setSelectedImage((prev) => {
        if (prev === null || !book) return prev;
        const step = showDoublePage ? 2 : 1;
        const newIdx = dir === "prev" ? prev - step : prev + step;
        const clampedIdx = Math.max(
          0,
          Math.min(book.pages.length - (showDoublePage ? 2 : 1), newIdx)
        );
        return clampedIdx;
      });
    },
    [book, showDoublePage]
  );

  const preloadImages = useCallback(() => {
    if (!book || selectedImage === null) return;
    const imagesToPreload: string[] = [];
    for (let i = 0; i < PRELOAD_COUNT; i++) {
      const idx = selectedImage + i;
      if (idx < book.pages.length) {
        imagesToPreload.push(book.pages[idx].url);
        if (showDoublePage && idx + 1 < book.pages.length) {
          imagesToPreload.push(book.pages[idx + 1].url);
        }
      }
    }
    imagesToPreload.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, [book, selectedImage, showDoublePage]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setBook(null);
    setLoading(true);
    setError(null);
    setSelectedImage(null);
    setShowModal(false);
  }, [id]);

  useEffect(() => {
    if (showModal) preloadImages();
  }, [showModal, selectedImage, preloadImages, showDoublePage]);

  const copyBookId = useCallback(() => {
    if (!book) return;
    navigator.clipboard.writeText(String(book.id)).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  }, [book]);

  const toggleMagnifier = useCallback(() => {
    setIsMagnifierActive((prev) => {
      const newState = !prev;
      setShowMagnifierHint(true);
      setShowControlHints(true);
      setTimeout(() => {
        setShowMagnifierHint(false);
        setShowControlHints(false);
      }, 3000);
      return newState;
    });
  }, []);

  const [magnifierData, setMagnifierData] = useState({
    pageIdx: 0,
    cx: 0,
    cy: 0,
    nx: 0,
    ny: 0,
  });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return;
    const containerRect = imageRef.current.getBoundingClientRect();

    const cx = e.clientX - containerRect.left;
    const cy = e.clientY - containerRect.top;

    let pageIdx = 0;
    let nx = 0,
      ny = 0;
    imageRefs.current.forEach((img, idx) => {
      if (!img) return;
      const r = img.getBoundingClientRect();
      const inX = e.clientX - r.left;
      const inY = e.clientY - r.top;
      if (inX >= 0 && inX <= r.width && inY >= 0 && inY <= r.height) {
        pageIdx = idx;
        nx = (inX / r.width) * img.naturalWidth;
        ny = (inY / r.height) * img.naturalHeight;
      }
    });

    setMagnifierData({ pageIdx, cx, cy, nx, ny });
  }, []);

  const handleTouchStartMagnifier = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!imageRef.current) return;
      const rect = imageRef.current.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const y = e.touches[0].clientY - rect.top;
      setCursorPosition({ x, y });

      longPressTimer.current = setTimeout(() => {
        setIsMagnifierActive(true);
        setShowMagnifierHint(true);
        setShowControlHints(true);
        setTimeout(() => {
          setShowMagnifierHint(false);
          setShowControlHints(false);
        }, 3000);

        let hoveredIdx = null;
        imageRefs.current.forEach((img, idx) => {
          if (img) {
            const imgRect = img.getBoundingClientRect();
            const relativeX = e.touches[0].clientX - imgRect.left;
            const relativeY = e.touches[0].clientY - imgRect.top;
            if (
              relativeX >= 0 &&
              relativeX <= imgRect.width &&
              relativeY >= 0 &&
              relativeY <= imgRect.height
            ) {
              hoveredIdx = idx;
              setMagnifierPosition({
                x: relativeX,
                y: relativeY,
              });
            }
          }
        });
        setHoveredImageIndex(hoveredIdx);
      }, 500);
    },
    []
  );

  const handleTouchMoveMagnifier = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!imageRef.current) return;
      const rect = imageRef.current.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const y = e.touches[0].clientY - rect.top;
      setCursorPosition({ x, y });

      const screenWidth = window.innerWidth;
      const cursorScreenX = e.touches[0].clientX;
      if (cursorScreenX < screenWidth / 3) {
        setMagnifierSide("left");
      } else if (cursorScreenX > (2 * screenWidth) / 3) {
        setMagnifierSide("right");
      } else {
        setMagnifierSide("center");
      }

      if (!isMagnifierActive) return;

      let hoveredIdx = null;
      imageRefs.current.forEach((img, idx) => {
        if (img) {
          const imgRect = img.getBoundingClientRect();
          const relativeX = e.touches[0].clientX - imgRect.left;
          const relativeY = e.touches[0].clientY - imgRect.top;
          if (
            relativeX >= 0 &&
            relativeX <= imgRect.width &&
            relativeY >= 0 &&
            relativeY <= imgRect.height
          ) {
            hoveredIdx = idx;
            setMagnifierPosition({
              x: relativeX,
              y: relativeY,
            });
          }
        }
      });
      setHoveredImageIndex(hoveredIdx);
    },
    [isMagnifierActive]
  );

  const handleTouchEndMagnifier = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, []);

  const handleZoom = useCallback((newZoom: number) => {
    if (!imageRef.current || !imageRefs.current[0]) return;
    setZoomLevel(newZoom);
    localStorage.setItem("bookZoomLevel", newZoom.toString());
  }, []);

  const handleMagnifierZoom = useCallback((newMagnifierZoom: number) => {
    setMagnifierZoomLevel(newMagnifierZoom);
    localStorage.setItem("bookMagnifierZoomLevel", newMagnifierZoom.toString());
  }, []);

  const handleMagnifierSize = useCallback((newSize: number) => {
    setMagnifierSize(newSize);
    localStorage.setItem("bookMagnifierSize", newSize.toString());
  }, []);

  const handleRotation = useCallback((newRotation: number) => {
    setRotation(newRotation);
    localStorage.setItem("bookRotation", newRotation.toString());
  }, []);

  const handleShowDoublePage = useCallback((newState: boolean) => {
    setShowDoublePage(newState);
    localStorage.setItem("bookShowDoublePage", JSON.stringify(newState));
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.shiftKey) {
        handleMagnifierSize(
          Math.max(50, Math.min(magnifierSize + (e.deltaY > 0 ? -10 : 10), 300))
        );
      } else if (isMagnifierActive) {
        handleMagnifierZoom(
          Math.max(
            1,
            Math.min(magnifierZoomLevel + (e.deltaY > 0 ? -0.1 : 0.1), 5)
          )
        );
      }
    },
    [
      isMagnifierActive,
      magnifierSize,
      magnifierZoomLevel,
      handleMagnifierSize,
      handleMagnifierZoom,
    ]
  );

  useEffect(() => {
    if (!showModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigateImage("prev");
      if (e.key === "ArrowRight") navigateImage("next");
      if (e.key === "Escape") closeImageModal();
      if (e.key === "+") handleZoom(Math.min(zoomLevel + 0.1, 3));
      if (e.key === "-") handleZoom(Math.max(zoomLevel - 0.1, 0.5));
      if (e.key === "m" || e.key === "M") toggleMagnifier();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showModal,
    navigateImage,
    closeImageModal,
    zoomLevel,
    handleZoom,
    toggleMagnifier,
  ]);

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
        <motion.button
          whileHover={{ scale: 1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(-1)}
          className={styles.backButton}
        >
          Назад
        </motion.button>
      </div>
    );

  const isFavorite = favorites.includes(book.id);
  const title = book.title.pretty || book.title.english || book.title.japanese;

  return (
    <div className={styles.container}>
      <div className={styles.mainSplitLayout}>
        <motion.aside
          className={styles.infoPanel}
          transition={{ duration: 0.3 }}
        >
          <SmartImage
            src={book.cover || book.thumbnail}
            alt="Обложка"
            className={styles.coverLarge}
          />
          {/* backgroundOverlayGray */}
          <div className={styles.backgroundOverlayGray}></div>
          <div className={styles.cardActions}>
            <motion.button
              whileHover={{ scale: 1 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleFavorite}
              className={isFavorite ? styles.favorite : ""}
              title={
                isFavorite ? "Убрать из избранного" : "Добавить в избранное"
              }
            >
              {isFavorite ? <FaHeart /> : <FiHeart />}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() =>
                window.open(`https://nhentai.net/g/${book.id}`, "_blank")
              }
              title="Открыть на сайте"
            >
              <FiExternalLink />
            </motion.button>
          </div>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <FiCalendar className={styles.metaIcon} />
              <span>{new Date(book.uploaded).toLocaleDateString("ru-RU")}</span>
            </div>
            <div className={styles.metaItem}>
              <FiBookOpen className={styles.metaIcon} />
              <span>{book.pagesCount} стр.</span>
            </div>
            <div className={styles.metaItem}>
              <FiHeart className={styles.metaIcon} />
              <span>{book.favorites.toLocaleString()}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.bookId} onClick={copyBookId} title="ID">
                ID: {book.id} <FiCopy />
                <AnimatePresence>
                  {isCopied && (
                    <motion.span
                      className={styles.copiedTooltip}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      Скопировано!
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </div>
          </div>
          {book.scanlator && (
            <div className={styles.scanlatorBlock}>
              <span>Перевод: {book.scanlator}</span>
            </div>
          )}
          <div className={styles.tagsBlock}>
            {sortedTags.map(({ type, label, tags }) => (
              <div key={type} className={styles.tagsCategoryRow}>
                <span
                  className={styles.tagsCategoryTitle}
                  style={{ color: TAG_COLORS[type] || "#aaa" }}
                >
                  {label}:
                </span>
                <div className={styles.tagsCategoryList}>
                  {tags.map((tag) => {
                    const selected = selectedTags.some(
                      (t) =>
                        Number(t.id) === Number(tag.id) &&
                        t.name.trim() === tag.name.trim()
                    );
                    return (
                      <motion.span
                        key={tag.id}
                        className={`${styles.tag} ${
                          selected ? styles.tagSelected : ""
                        }`}
                        style={{
                          color: TAG_COLORS[type] || "#ccc",
                          borderColor: TAG_COLORS[type] || "#ccc",
                        }}
                        onClick={() => handleTagClick(tag)}
                        title={tag.count ? `Используется: ${tag.count}` : ""}
                        whileHover={{
                          y: -2,
                          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                        }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {tag.name}
                        {type === "language" && (
                          <ReactCountryFlag
                            countryCode={
                              languageCountryCodes[tag.name.toLowerCase()]
                            }
                            svg
                            title={tag.name}
                            style={{ marginLeft: "4px" }}
                          />
                        )}
                      </motion.span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </motion.aside>
        <main className={styles.galleryPanel}>
          <section className={styles.gallerySection}>
            <h2>Страницы</h2>
            <div className={styles.grid}>
              {book.pages.map((page, idx) => (
                <motion.div
                  key={idx}
                  className={styles.gridItem}
                  onClick={() => openImageModal(idx)}
                  whileHover={{ scale: 1 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <SmartImage
                    src={
                      isMobile
                        ? page.url
                        : page.urlThumb || page.url
                    }
                    alt={`Страница ${idx + 1}`}
                    className={styles.thumbnail}
                    loading="lazy"
                  />
                  <div className={styles.pageNumber}>{idx + 1}</div>
                </motion.div>
              ))}
            </div>
          </section>
        </main>
      </div>
      {relatedBooks.length > 0 && (
        <section className={styles.relatedBooksSection}>
          <h2>
            Похожие книги{" "}
            <span
              style={{
                fontWeight: 400,
                fontSize: "0.98em",
                color: "var(--colour-l3)",
              }}
            >
              [Бета]
            </span>
          </h2>
          <div className={styles.relatedBooksGrid}>
            {relatedBooks.map((relatedBook) => (
              <BookCard
                key={relatedBook.id}
                book={relatedBook}
                isFavorite={favorites.includes(relatedBook.id)}
                onToggleFavorite={(bookId, newState) => {
                  const newFavorites = newState
                    ? [...favorites, bookId]
                    : favorites.filter((id) => id !== bookId);
                  setFavorites(newFavorites);
                  localStorage.setItem(
                    "bookFavorites",
                    JSON.stringify(newFavorites)
                  );
                }}
                className={styles.relatedBookCard}
              />
            ))}
          </div>
        </section>
      )}
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
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
            >
              <div className={`${styles.modalHeader} ${styles.noDrag}`}>
                <motion.button
                  whileHover={{ rotate: 90 }}
                  onClick={closeImageModal}
                  className={styles.closeButton}
                  title="Закрыть"
                >
                  <FiX />
                </motion.button>
                <div className={styles.controls}>
                  <motion.button
                    whileHover={{ scale: 1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleZoom(Math.max(zoomLevel - 0.1, 0.5))}
                    title="Масштаб -"
                  >
                    <FiZoomOut />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleZoom(Math.min(zoomLevel + 0.1, 3))}
                    title="Масштаб +"
                  >
                    <FiZoomIn />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleRotation((rotation + 90) % 360)}
                    title="Повернуть"
                  >
                    <FiRotateCw />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleShowDoublePage(!showDoublePage)}
                    title={showDoublePage ? "Одна страница" : "Две страницы"}
                  >
                    <FiImage /> {showDoublePage ? "1" : "2"}
                  </motion.button>
                  <div
                    className={styles.magnifierButtonWrapper}
                    onMouseEnter={() => setShowControlHints(true)}
                    onMouseLeave={() =>
                      !isMagnifierActive && setShowControlHints(false)
                    }
                  >
                    <motion.button
                      whileHover={{ scale: 1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={toggleMagnifier}
                      className={
                        isMagnifierActive ? styles.activeMagnifier : ""
                      }
                      title="Лупа (M)"
                    >
                      <FiSearch />
                    </motion.button>
                    <AnimatePresence>
                      {showControlHints && (
                        <motion.div
                          className={styles.controlHints}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                        >
                          <span>Shift + Scroll: Размер лупы</span>
                          <span>Scroll: Зум лупы</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              <div className={styles.imageViewer}>
                <motion.button
                  className={styles.navButton}
                  onClick={() => navigateImage("prev")}
                  disabled={selectedImage === 0}
                  title="Назад"
                  whileHover={{ scale: 1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FiChevronLeft />
                </motion.button>
                <div
                  className={styles.imageContainer}
                  onMouseMove={handleMouseMove}
                  onTouchStart={handleTouchStartMagnifier}
                  onTouchMove={handleTouchMoveMagnifier}
                  onTouchEnd={handleTouchEndMagnifier}
                  onWheel={handleWheel}
                  ref={imageRef}
                >
                  <div className={styles.imageWrapper}>
                    <SmartImage
                      src={book.pages[selectedImage].url}
                      alt={`Страница ${selectedImage + 1}`}
                      className={styles.modalImage}
                      key={selectedImage}
                      style={{
                        transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                        transformOrigin: "center center",
                      }}
                      innerRef={(el) => {
                        imageRefs.current[0] = el;
                      }}
                    />
                    {showDoublePage &&
                      selectedImage + 1 < book.pages.length && (
                        <SmartImage
                          src={book.pages[selectedImage + 1].url}
                          alt={`Страница ${selectedImage + 2}`}
                          className={styles.modalImage}
                          key={selectedImage + 1}
                          style={{
                            transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                            transformOrigin: "center center",
                          }}
                          innerRef={(el) => {
                            imageRefs.current[1] = el;
                          }}
                        />
                      )}
                  </div>
                  {isMagnifierActive && (
                    <div
                      className={styles.magnifier}
                      style={{
                        width: magnifierSize,
                        minWidth: magnifierSize,
                        height: magnifierSize,
                        minHeight: magnifierSize,
                        top: magnifierData.cy,
                        left: magnifierData.cx,
                        transform: "translate(-50%, -50%)",
                        backgroundImage: `url(${
                          book.pages[selectedImage + magnifierData.pageIdx].url
                        })`,
                        backgroundSize: `${
                          (imageRefs.current[magnifierData.pageIdx]
                            ?.naturalWidth || 0) * magnifierZoomLevel
                        }px ${
                          (imageRefs.current[magnifierData.pageIdx]
                            ?.naturalHeight || 0) * magnifierZoomLevel
                        }px`,
                        backgroundPosition: `${-(
                          magnifierData.nx * magnifierZoomLevel -
                          magnifierSize / 2
                        )}px ${-(
                          magnifierData.ny * magnifierZoomLevel -
                          magnifierSize / 2
                        )}px`,
                      }}
                    />
                  )}
                  <AnimatePresence>
                    {showMagnifierHint && (
                      <motion.div
                        className={styles.magnifierHint}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        {window.innerWidth <= 768
                          ? "Долгий тап для активации лупы"
                          : `Лупа ${
                              isMagnifierActive ? "включена" : "выключена"
                            } (M)`}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <motion.button
                  className={styles.navButton}
                  onClick={() => navigateImage("next")}
                  disabled={
                    selectedImage >=
                    book.pages.length - (showDoublePage ? 2 : 1)
                  }
                  title="Вперёд"
                  whileHover={{ scale: 1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <FiChevronRight />
                </motion.button>
              </div>
              <div className={`${styles.modalFooter} ${styles.noDrag}`}>
                <span>
                  Стр. {selectedImage + 1}
                  {showDoublePage && selectedImage + 1 < book.pages.length
                    ? `-${selectedImage + 2}`
                    : ""}{" "}
                  из {book.pages.length}
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
