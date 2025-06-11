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
  tag: "#A1A1C3",
};

const languageCountryCodes: Record<string, string> = {
  english: "GB",
  chinese: "CN",
  japanese: "JP",
};

const SUPPORTED_LANGUAGES = Object.keys(languageCountryCodes);

const PRELOAD_COUNT = 5;

const BookPage: React.FC = () => {
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

  const sortedTags = useMemo(() => {
    const categories = [
      {
        type: "language",
        filter: (t: Tag) => SUPPORTED_LANGUAGES.includes(t.name.toLowerCase()),
      },
      { type: "artist", filter: (t: Tag) => t.type === "artist" },
      { type: "character", filter: (t: Tag) => t.type === "character" },
      { type: "parody", filter: (t: Tag) => t.type === "parody" },
      { type: "group", filter: (t: Tag) => t.type === "group" },
      { type: "category", filter: (t: Tag) => t.type === "category" },
      { type: "tag", filter: () => true },
    ];

    if (!book || !book.tags) return [];
    const uniqueTags = book.tags.filter(
      (tag, idx, arr) =>
        idx === arr.findIndex((t) => t.id === tag.id && t.name === tag.name)
    );

    const usedIds = new Set<string>();
    return categories.reduce((acc, { type, filter }) => {
      const bucket = uniqueTags.filter((t) => {
        const id = String(t.id);
        return !usedIds.has(id) && filter(t);
      });
      if (bucket.length) {
        bucket.forEach((t) => usedIds.add(String(t.id)));
        acc.push({ type, tags: bucket });
      }
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
        <p>Loading book...</p>
      </div>
    );

  if (error || !book)
    return (
      <div className={styles.errorContainer}>
        <div className={styles.error}>{error || "Book not found"}</div>
        <button onClick={() => navigate(-1)} className={styles.backButton}>
          Go back
        </button>
      </div>
    );

  const isFavorite = favorites.includes(book.id);
  const title = book.title.pretty || book.title.english || book.title.japanese;

  return (
    <div className={styles.container}>
      <section className={styles.bookCard}>
        <button onClick={() => navigate(-1)} className={styles.backButton}>
          <FiChevronLeft /> Back
        </button>
        <div className={styles.cardContent}>
          <SmartImage
            src={book.cover || book.thumbnail}
            alt="Cover"
            className={styles.cover}
          />
          <div className={styles.cardDetails}>
            <h1 className={styles.title}>{title}</h1>
            <div className={styles.metaRow}>
              <div className={styles.metaItem}>
                <FiCalendar />{" "}
                {new Date(book.uploaded).toLocaleDateString("en-EN")}
              </div>
              <div className={styles.metaItem}>
                <FiBookOpen /> {book.pagesCount} page.
              </div>
              <div className={styles.metaItem}>
                <FiHeart /> {book.favorites.toLocaleString()}
              </div>
              <div className={styles.metaItem}>
                <span className={styles.bookId} onClick={copyBookId}>
                  ID: {book.id} <FiCopy />
                </span>
                {isCopied && (
                  <span className={styles.copiedTooltip}>Copied!</span>
                )}
              </div>
            </div>
            <div className={styles.tags}>
              {sortedTags.map(({ type, tags }) =>
                tags.map((tag) => (
                  <span
                    key={tag.id}
                    className={`${styles.tag} ${
                      selectedTags.some(
                        (t) =>
                          Number(t.id) === Number(tag.id) &&
                          t.name.trim() === tag.name.trim()
                      )
                        ? styles.tagSelected
                        : ""
                    }`}
                    style={{
                      backgroundColor: TAG_COLORS[type] || TAG_COLORS.tag,
                    }}
                    onClick={() => handleTagClick(tag)}
                  >
                    {tag.name}
                    {type === "language" && (
                      <ReactCountryFlag
                        countryCode={
                          languageCountryCodes[tag.name.toLowerCase()]
                        }
                        svg
                        className={styles.languageFlag}
                        title={tag.name}
                      />
                    )}
                  </span>
                ))
              )}
            </div>
            <div className={styles.actions}>
              <button
                onClick={toggleFavorite}
                className={`${styles.actionButton} ${
                  isFavorite ? styles.favorite : ""
                }`}
              >
                {isFavorite ? <FaHeart /> : <FiHeart />}
              </button>
              <button
                onClick={() =>
                  window.open(`https://nhentai.net/g/${book.id}`, "_blank")
                }
                className={styles.actionButton}
              >
                <FiExternalLink />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.gallery}>
        <div className={styles.grid}>
          {book.pages.map((page, idx) => (
            <div
              key={idx}
              className={styles.gridItem}
              onClick={() => openImageModal(idx)}
            >
              <SmartImage
                src={page.urlThumb || page.url}
                alt={`Page ${idx + 1}`}
                className={styles.thumbnail}
                loading="lazy"
              />
              <div className={styles.pageNumber}>{idx + 1}</div>
            </div>
          ))}
        </div>
      </section>
      <section className={styles.relatedBooks}>
        <h2 className={styles.relatedBooksTitle}>
          Related<span className={styles.betaBadge}>BETA</span>
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

      {showModal && selectedImage !== null && (
        <div className={styles.modalOverlay} onClick={closeImageModal}>
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`${styles.modalHeader} ${styles.noDrag}`}>
              <div className={styles.controls}>
                <button
                  onClick={() => handleZoom(Math.max(zoomLevel - 0.1, 0.5))}
                >
                  <FiZoomOut />
                </button>
                <button
                  onClick={() => handleZoom(Math.min(zoomLevel + 0.1, 3))}
                >
                  <FiZoomIn />
                </button>
                <button onClick={() => handleRotation((rotation + 90) % 360)}>
                  <FiRotateCw />
                </button>
                <button onClick={() => handleShowDoublePage(!showDoublePage)}>
                  <FiImage /> {showDoublePage ? "1 page." : "2 page."}
                </button>
                <div
                  className={styles.magnifierButtonWrapper}
                  onMouseEnter={() => setShowControlHints(true)}
                  onMouseLeave={() =>
                    !isMagnifierActive && setShowControlHints(false)
                  }
                >
                  <button
                    onClick={toggleMagnifier}
                    className={isMagnifierActive ? styles.activeMagnifier : ""}
                  >
                    <FiSearch />
                  </button>
                  {showControlHints && (
                    <div className={styles.controlHints}>
                      <span>Shift + Scroll: Change the magnifier size</span>
                      <span>Scroll: Change the magnifier zoom</span>
                    </div>
                  )}
                </div>
              </div>
              <button onClick={closeImageModal} className={styles.closeButton}>
                <FiX />
              </button>
            </div>

            <div className={styles.imageViewer}>
              <button
                className={styles.navButton}
                onClick={() => navigateImage("prev")}
                disabled={selectedImage === 0}
              >
                <FiChevronLeft />
              </button>

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
                    alt={`Page ${selectedImage + 1}`}
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
                  {showDoublePage && selectedImage + 1 < book.pages.length && (
                    <SmartImage
                      src={book.pages[selectedImage + 1].url}
                      alt={`Page ${selectedImage + 2}`}
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

                {showMagnifierHint && (
                  <div className={styles.magnifierHint}>
                    {window.innerWidth <= 768
                      ? "Long touch to activate the magnifier"
                      : `Magnifier ${
                          isMagnifierActive ? "enabled" : "disabled"
                        } (hotkey: M)`}
                  </div>
                )}
              </div>

              <button
                className={styles.navButton}
                onClick={() => navigateImage("next")}
                disabled={
                  selectedImage >= book.pages.length - (showDoublePage ? 2 : 1)
                }
              >
                <FiChevronRight />
              </button>
            </div>

            <div className={`${styles.modalFooter} ${styles.noDrag}`}>
              <span>
                Page {selectedImage + 1}
                {showDoublePage && selectedImage + 1 < book.pages.length
                  ? `-${selectedImage + 2}`
                  : ""}{" "}
                из {book.pages.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookPage;
