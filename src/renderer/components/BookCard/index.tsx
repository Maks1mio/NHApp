import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as styles from "./BookCard.module.scss";
import SmartImage from "../SmartImage";
import { FiHeart, FiEye, FiBookOpen, FiCalendar } from "react-icons/fi";
import { FaHeart } from "react-icons/fa";

interface Tag {
  id: number;
  type: string;
  name: string;
  url: string;
  count: number;
}

export interface Book {
  [x: string]: any;
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

interface BookCardProps {
  book: Book;
  isFavorite: boolean;
  onToggleFavorite?: (id: number) => void; // ← optional
  className?: string;
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const BookCard: React.FC<BookCardProps> = ({
  book,
  isFavorite,
  onToggleFavorite,
  className = "",
}) => {
  const navigate = useNavigate();

  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false); // открыта ли модалка
  const [shouldRenderPreview, setShouldRenderPreview] = useState(false); // нужна ли обёртка (для анимации)
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isMouseMoving, setIsMouseMoving] = useState(false);

  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const carouselTimer = useRef<NodeJS.Timeout | null>(null);
  const movementTimer = useRef<NodeJS.Timeout | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const truncateText = (text: string, maxLines = 2) => {
    const words = text.split(" ");
    let truncated = "";
    let lineCount = 0;

    for (const word of words) {
      if ((truncated + word).length > 50 * (lineCount + 1)) {
        lineCount++;
        if (lineCount >= maxLines) {
          return truncated.trim() + "...";
        }
        truncated += "\n";
      }
      truncated += word + " ";
    }
    return truncated.trim();
  };

  // —————————————————————————————————————————————
  // Очистка таймеров при размонтировании
  useEffect(() => {
    return () => {
      hoverTimer.current && clearTimeout(hoverTimer.current);
      carouselTimer.current && clearTimeout(carouselTimer.current);
      movementTimer.current && clearTimeout(movementTimer.current);
    };
  }, []);
  // —————————————————————————————————————————————

  // Движение мыши по карточке
  const handleMouseMove: React.MouseEventHandler = (e) => {
    const newPos = { x: e.clientX, y: e.clientY };
    const moved = mousePosition.x !== newPos.x || mousePosition.y !== newPos.y;
    setMousePosition(newPos);

    if (moved) {
      setIsMouseMoving(true);
      hoverTimer.current && clearTimeout(hoverTimer.current);
      movementTimer.current && clearTimeout(movementTimer.current);

      // ждём, пока мышь остановится
      movementTimer.current = setTimeout(() => {
        setIsMouseMoving(false);
        if (isHovered && !showPreview) {
          hoverTimer.current = setTimeout(() => {
            setShowPreview(true);
            startCarouselAutoScroll();
          }, 500);
        }
      }, 200);
    }
  };

  // навели мышь на карточку
  const handleMouseEnter = () => {
    setIsHovered(true);
    setShouldRenderPreview(true);
    if (!isMouseMoving) {
      hoverTimer.current = setTimeout(() => {
        setShowPreview(true);
        startCarouselAutoScroll();
      }, 3500);
    }
  };

  // вывели мышь
  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsMouseMoving(false);

    hoverTimer.current && clearTimeout(hoverTimer.current);
    carouselTimer.current && clearTimeout(carouselTimer.current);
    movementTimer.current && clearTimeout(movementTimer.current);

    setShowPreview(false);
    // даём анимации скрытия завершиться
    setTimeout(() => setShouldRenderPreview(false), 300);
  };

  // автопрокрутка мини-карусели
  const startCarouselAutoScroll = () => {
    if (book.pages.length <= 1) return;
    const scroll = () => {
      setActiveImageIndex(
        (prev) => (prev + 1) % Math.min(book.pages.length, 5)
      );
      carouselTimer.current = setTimeout(scroll, 3000);
    };
    carouselTimer.current = setTimeout(scroll, 3000);
  };

  // ручной выбор страницы в карусели
  const handleCarouselHover: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!carouselRef.current || book.pages.length <= 1) return;
    const { left, width } = carouselRef.current.getBoundingClientRect();
    const mouseX = e.clientX - left;
    const segmentWidth = width / Math.min(book.pages.length, 5);
    const idx = Math.min(
      Math.floor(mouseX / segmentWidth),
      Math.min(book.pages.length, 5) - 1
    );
    setActiveImageIndex(idx);

    carouselTimer.current && clearTimeout(carouselTimer.current);
    carouselTimer.current = setTimeout(startCarouselAutoScroll, 5000);
  };

  // плавный скролл при смене activeImageIndex
  useEffect(() => {
    if (carouselRef.current) {
      const imageWidth = 200 + 10; // ширина + gap
      carouselRef.current.scrollTo({
        left: activeImageIndex * imageWidth,
        behavior: "smooth",
      });
    }
  }, [activeImageIndex]);

  const onTagClick = (tagName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/search?q=${encodeURIComponent(tagName)}`);
  };

  const handleCardClick = () => navigate(`/book/${book.id}`);

  // —————————————————————————————————————————————
  // JSX
  // —————————————————————————————————————————————
  return (
    <div
      ref={cardRef}
      className={`${styles.card} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onClick={handleCardClick}
    >
      {/* Обложка */}
      <div className={styles.imageContainer}>
        <SmartImage
          src={book.thumbnail} // единственный надёжный URL
          alt={book.title.pretty}
          className={styles.previewImage}
          loading="lazy"
        />

        {/* Overlay с кнопкой избранного и счётчиками */}
        <div className={`${styles.overlay} ${isHovered ? styles.visible : ""}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.(book.id); // ← безопасный вызов
            }}
            className={styles.favoriteButton}
            aria-label={
              isFavorite ? "Удалить из избранного" : "Добавить в избранное"
            }
          >
            {isFavorite ? (
              <FaHeart className={styles.favoriteIconActive} />
            ) : (
              <FiHeart className={styles.favoriteIcon} />
            )}
          </button>
          <div className={styles.stats}>
            <span className={styles.stat}>
              <FiEye /> {book.media}
            </span>
            <span className={styles.stat}>
              <FiBookOpen /> {book.pagesCount}
            </span>
          </div>
        </div>
      </div>

      {/* Текстовая часть карточки */}
      <div className={styles.info}>
        <p className={styles.titleText} title={book.title.pretty}>
          {truncateText(book.title.pretty)}
        </p>

        <div className={styles.meta}>
          <span className={styles.date}>
            <FiCalendar /> {formatDate(book.uploaded)}
          </span>
          <span className={styles.favorites}>
            <FiHeart /> {book.favorites}
          </span>
        </div>

        <div className={styles.tags}>
          {book.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className={styles.tag}
              onClick={(e) => onTagClick(tag.name, e)}
              style={{ cursor: "pointer" }}
            >
              {tag.name}
            </span>
          ))}
          {book.tags.length > 3 && (
            <span className={styles.moreTags}>+{book.tags.length - 3}</span>
          )}
        </div>
      </div>

      {/* ────────────────────────────────────────
          ПРЕВЬЮ-МОДАЛКА
          ──────────────────────────────────────── */}
      {shouldRenderPreview && (
        <div
          className={`${styles.previewContainer} ${
            showPreview ? styles.visible : ""
          }`}
          onMouseLeave={handleMouseLeave}
        >
          {/* Контент подгружаем только при открытии */}
          {showPreview && (
            <div className={styles.previewContent}>
              {/* Карусель страниц */}
              <div
                className={styles.previewCarousel}
                ref={carouselRef}
                onMouseMove={handleCarouselHover}
              >
                {book.pages.slice(0, 5).map((page, idx) => (
                  <div
                    key={idx}
                    className={`${styles.previewImageWrapper} ${
                      idx === activeImageIndex ? styles.active : ""
                    }`}
                  >
                    <SmartImage
                      src={page.urlThumb}
                      alt={book.title.pretty}
                      className={styles.previewImage}
                    />
                  </div>
                ))}
              </div>

              {/* Информация о книге */}
              <div className={styles.previewInfo}>
                <h3 className={styles.previewTitle}>
                  {truncateText(book.title.pretty)}
                </h3>

                <div className={styles.previewMeta}>
                  <span>
                    <FiCalendar /> {formatDate(book.uploaded)}
                  </span>
                  <span>
                    <FiBookOpen /> {book.pagesCount} pages
                  </span>
                  <span>
                    <FiHeart /> {book.favorites} favorites
                  </span>
                </div>

                <div className={styles.previewTags}>
                  {book.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className={styles.previewTag}
                      onClick={(e) => onTagClick(tag.name, e)}
                      style={{ cursor: "pointer" }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>

                {book.scanlator && (
                  <div className={styles.scanlator}>
                    Scanlator: {book.scanlator}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BookCard;
