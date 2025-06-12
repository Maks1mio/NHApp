import React, { useState, useEffect, useRef, MouseEvent, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import * as styles from "./BookCard.module.scss";
import SmartImage from "../SmartImage";
import { FiHeart, FiEye, FiBookOpen, FiCalendar } from "react-icons/fi";
import { FaHeart } from "react-icons/fa";
import ReactCountryFlag from "react-country-flag";
import { useTagFilter, Tag } from "../../../context/TagFilterContext";

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
  isNew?: boolean;
  onToggleFavorite?: (id: number, newState: boolean) => void;
  className?: string;
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const languageCountryCodes: Record<string, string> = {
  english: "GB",
  chinese: "CN",
  japanese: "JP",
};

const SUPPORTED_LANGUAGES = Object.keys(languageCountryCodes);

const TAG_COLORS: Record<string, string> = {
  language: "#FF7D7F",
  artist: "#FB8DF4",
  character: "#F3E17F",
  parody: "#BCEA83",
  group: "#86F0C6",
  category: "#92EFFF",
  tag: "background-color: hsl(var(--base-hue), 32%, 36%) !important",
};

const BookCard: React.FC<BookCardProps> = ({
  book,
  isFavorite,
  onToggleFavorite,
  className = "",
}) => {
  const navigate = useNavigate();
  const { selectedTags, setSelectedTags } = useTagFilter();
  const isNew =
    book.uploaded &&
    new Date(book.uploaded) > new Date(Date.now() - 24 * 60 * 60 * 1000);

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
  }, [book.tags]);

  const idsEqual = (a: string | number, b: string | number) =>
    Number(a) === Number(b);

  const isTagSelected = (tag: Tag) =>
    selectedTags.some(
      (t) =>
        idsEqual(t.id, tag.id) &&
        t.name.trim().replace(/\s+/g, " ") ===
          tag.name.trim().replace(/\s+/g, " ")
    );

  const normalize = (tag: Tag): Tag => ({
    ...tag,
    id: String(tag.id),
    name: tag.name.trim().replace(/\s+/g, " "),
    url: tag.url.startsWith("/") ? `https://nhentai.net${tag.url}` : tag.url,
  });

  const handleTagClick = (tag: Tag, e: MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    const normalized = normalize(tag);

    const tagsEqual = (a: Tag, b: Tag) =>
      Number(a.id) === Number(b.id) &&
      a.name.trim().replace(/\s+/g, " ") === b.name.trim().replace(/\s+/g, " ");

    const existingIndex = selectedTags.findIndex((t) =>
      tagsEqual(t, normalized)
    );

    const newTags = [...selectedTags];
    if (existingIndex >= 0) {
      newTags.splice(existingIndex, 1);
    } else {
      newTags.push(normalized);
    }

    setSelectedTags(newTags);
  };

  const toggleFav = (e: MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(book.id, !isFavorite);
    } else {
      const key = "bookFavorites";
      const list = JSON.parse(localStorage.getItem(key) ?? "[]") as number[];
      const next = isFavorite
        ? list.filter((i) => i !== book.id)
        : [...list, book.id];
      localStorage.setItem(key, JSON.stringify(next));
    }
  };

  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [shouldRenderPreview, setShouldRenderPreview] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isMouseMoving, setIsMouseMoving] = useState(false);

  const carouselRef = useRef<HTMLDivElement>(null);

  const timers = useRef<{
    hover: NodeJS.Timeout | null;
    carousel: NodeJS.Timeout | null;
    movement: NodeJS.Timeout | null;
    delay: NodeJS.Timeout | null;
  }>({ hover: null, carousel: null, movement: null, delay: null });

  const clearTimers = () => {
    Object.values(timers.current).forEach((timer) => {
      if (timer) clearTimeout(timer);
    });
    timers.current = {
      hover: null,
      carousel: null,
      movement: null,
      delay: null,
    };
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const startCarousel = () => {
    if (book.pages.length <= 1) return;

    const tick = () => {
      setActiveImageIndex(
        (prev) => (prev + 1) % Math.min(book.pages.length, 5)
      );
      timers.current.carousel = setTimeout(tick, 3000);
    };

    timers.current.carousel = setTimeout(tick, 3000);
  };

  const stopCarousel = () => {
    if (timers.current.carousel) {
      clearTimeout(timers.current.carousel);
      timers.current.carousel = null;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const newPos = { x: e.clientX, y: e.clientY };
    const moved = mousePosition.x !== newPos.x || mousePosition.y !== newPos.y;
    setMousePosition(newPos);

    if (moved) {
      setIsMouseMoving(true);

      if (timers.current.movement) clearTimeout(timers.current.movement);
      if (timers.current.hover) clearTimeout(timers.current.hover);

      timers.current.movement = setTimeout(() => {
        setIsMouseMoving(false);
        if (isHovered && !showPreview) {
          timers.current.hover = setTimeout(() => {
            setShowPreview(true);
            startCarousel();
          }, 1000);
        }
      }, 400);
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    setShouldRenderPreview(true);

    clearTimers();

    if (!isMouseMoving) {
      timers.current.hover = setTimeout(() => {
        setShowPreview(true);
        startCarousel();
      }, 1300);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsMouseMoving(false);
    clearTimers();
    setShowPreview(false);
    stopCarousel();

    timers.current.delay = setTimeout(() => {
      setShouldRenderPreview(false);
    }, 1300);
  };

  const handleCarouselHover: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!carouselRef.current || book.pages.length <= 1) return;

    const { left, width } = carouselRef.current.getBoundingClientRect();
    const idx = Math.floor(
      (e.clientX - left) / (width / Math.min(book.pages.length, 5))
    );
    setActiveImageIndex(Math.min(idx, Math.min(book.pages.length, 5) - 1));

    stopCarousel();
    timers.current.carousel = setTimeout(startCarousel, 5000);
  };

  useEffect(() => {
    if (carouselRef.current && showPreview) {
      const imageWidth = 200 + 10;
      carouselRef.current.scrollTo({
        left: activeImageIndex * imageWidth,
        behavior: "smooth",
      });
    }
  }, [activeImageIndex, showPreview]);

  const truncateText = (text: string, maxLines = 2) => {
    const words = text.split(" ");
    let truncated = "";
    let lineCount = 0;
    for (const word of words) {
      if ((truncated + word).length > 50 * (lineCount + 1)) {
        lineCount++;
        if (lineCount >= maxLines) return truncated.trim() + "...";
        truncated += "\n";
      }
      truncated += word + " ";
    }
    return truncated.trim();
  };

  return (
    <div
      className={`${styles.card} ${className}`}
      onClick={() => navigate(`/book/${book.id}`)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      <div className={styles.imageContainer}>
        {isNew && <span className={styles.newBadge}>NEW</span>}
        <SmartImage
          src={book.thumbnail}
          alt={book.title.pretty}
          className={styles.image}
          loading="lazy"
        />

        {sortedTags
          .find((t) => t.type === "language")
          ?.tags.map((tag) => (
            <ReactCountryFlag
              key={tag.id}
              countryCode={languageCountryCodes[tag.name.toLowerCase()]}
              svg
              className={styles.languageFlag}
              title={tag.name}
            />
          ))}

        <div className={`${styles.overlay} ${isHovered ? styles.visible : ""}`}>
          <button
            className={styles.favoriteButton}
            aria-label={
              isFavorite ? "Удалить из избранного" : "Добавить в избранное"
            }
            onClick={toggleFav}
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
          {sortedTags.slice(0, 2).flatMap((category) =>
            category.tags
              .filter(
                (tag, index, self) =>
                  index ===
                  self.findIndex((t) => t.id === tag.id && t.name === tag.name)
              )
              .slice(0, 2)
              .map((tag) => (
                <span
                  key={`${tag.id}-${tag.name}`}
                  className={`${styles.tag} ${
                    isTagSelected(tag) ? styles.tagSelected : ""
                  }`}
                  onClick={(e) => handleTagClick(tag, e)}
                  style={{
                    color: TAG_COLORS[category.type] || TAG_COLORS.tag,
                    outline: isTagSelected(tag) ? "1px solid white" : "none",
                  }}
                >
                  {tag.name}
                </span>
              ))
          )}
          {sortedTags.reduce((acc, cat) => acc + cat.tags.length, 0) > 4 && (
            <span className={styles.moreTags}>
              +{sortedTags.reduce((acc, cat) => acc + cat.tags.length, 0) - 4}
            </span>
          )}
        </div>
      </div>

      {shouldRenderPreview && (
        <div
          className={`${styles.previewContainer} ${
            showPreview ? styles.visible : ""
          }`}
        >
          {showPreview && (
            <div className={styles.previewContent}>
              <div
                className={styles.previewCarousel}
                ref={carouselRef}
                onMouseMove={handleCarouselHover}
              >
                {book.pages.slice(0, 5).map((p, i) => (
                  <div
                    key={i}
                    className={`${styles.previewImageWrapper} ${
                      i === activeImageIndex ? styles.active : ""
                    }`}
                  >
                    <SmartImage
                      src={p.urlThumb}
                      alt={book.title.pretty}
                      className={styles.previewImage}
                    />
                  </div>
                ))}
              </div>

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
                  {sortedTags.map((category) => (
                    <React.Fragment key={category.type}>
                      {category.tags
                        .filter(
                          (tag, index, self) =>
                            index ===
                            self.findIndex(
                              (t) => t.id === tag.id && t.name === tag.name
                            )
                        )
                        .map((tag) => (
                          <span
                            key={`${tag.id}-${tag.name}`}
                            className={`${styles.previewTag} ${
                              isTagSelected(tag) ? styles.tagSelected : ""
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTagClick(tag, e);
                            }}
                            style={{
                              color:
                                TAG_COLORS[category.type] || TAG_COLORS.tag,
                              outline: isTagSelected(tag)
                                ? "1px solid white"
                                : "none",
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                    </React.Fragment>
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
