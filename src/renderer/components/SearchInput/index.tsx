import React, { useState, useEffect, useRef } from "react";
import {
  FiSearch,
  FiClock,
  FiX,
  FiTag,
  FiStar,
  FiTrendingUp,
  FiUpload,
  FiChevronDown,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import * as styles from "./SearchInput.module.scss";
import TagFilter from "../TagFilter";
import { useTagFilter } from "../../../context/TagFilterContext";
import { useFavorites } from "../../../context/FavoritesContext";

type ContentType = "search" | "new" | "popular" | "favorites";

interface SearchInputProps {
  onSearch: (query: string, contentType: ContentType) => void;
  className?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({ onSearch, className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const { favorites } = useFavorites();

  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showContentTypes, setShowContentTypes] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [contentType, setContentType] = useState<ContentType>(
    (queryParams.get("type") as ContentType) || "search"
  );

  const { selectedTags, setSelectedTags } = useTagFilter();
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const selectRef = useRef<HTMLDivElement>(null);

  // Определяем активный тип контента из URL
  useEffect(() => {
    const type = queryParams.get("type") as ContentType | null;
    if (type && ["search", "new", "popular", "favorites"].includes(type)) {
      setContentType(type);
    } else {
      setContentType("search");
    }
  }, [location.search]);

  const handleSearch = () => {
    if (query.trim()) {
      onSearch(query.trim(), "search");
      addToHistory(query.trim());
      setShowHistory(false);
      navigate(`/search?q=${encodeURIComponent(query.trim())}&type=search`);
    } else if (contentType === "search") {
      navigate(`/search?type=search`);
      onSearch("", "search");
    }
  };

  // Переключение типа контента
  const switchContentType = (type: ContentType) => {
    setContentType(type);
    setShowContentTypes(false);
    if (type === "search") {
      if (query.trim()) {
        navigate(`/search?q=${encodeURIComponent(query.trim())}&type=search`);
        onSearch(query.trim(), "search");
      } else {
        navigate(`/search?type=search`);
        onSearch("", "search");
      }
    } else {
      navigate(`/search?type=${type}`);
      setQuery("");
      onSearch("", type);
    }
  };

  useEffect(() => {
    const history = localStorage.getItem("searchHistory");
    if (history) setSearchHistory(JSON.parse(history));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  const addToHistory = (searchQuery: string) => {
    if (!searchQuery) return;
    const updatedHistory = [
      searchQuery,
      ...searchHistory.filter(
        (item) => item.toLowerCase() !== searchQuery.toLowerCase()
      ),
    ].slice(0, 100);

    setSearchHistory(updatedHistory);
    localStorage.setItem("searchHistory", JSON.stringify(updatedHistory));
  };

  const handleHistoryItemClick = (item: string) => {
    setQuery(item);
    onSearch(item, "search");
    setShowHistory(false);
    inputRef.current?.blur();
    navigate(`/search?q=${encodeURIComponent(item)}&type=search`);
  };

  const handleRemoveHistoryItem = (e: React.MouseEvent, item: string) => {
    e.stopPropagation();
    const updatedHistory = searchHistory.filter((i) => i !== item);
    setSearchHistory(updatedHistory);
    localStorage.setItem("searchHistory", JSON.stringify(updatedHistory));
  };

  // Закрытие выпадающих списков при клике вне
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setShowHistory(false);
        setShowContentTypes(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // При изменении тегов — сразу делать поиск
  useEffect(() => {
    onSearch(query, contentType);
  }, [selectedTags, contentType]);

  // Иконки для типов контента
  const getContentTypeIcon = (type: ContentType) => {
    switch (type) {
      case "search":
        return <FiSearch size={16} />;
      case "new":
        return <FiUpload size={16} />;
      case "popular":
        return <FiTrendingUp size={16} />;
      case "favorites":
        return <FiStar size={16} />;
      default:
        return <FiSearch size={16} />;
    }
  };

  // Названия для типов контента
  const getContentTypeLabel = (type: ContentType) => {
    switch (type) {
      case "search":
        return "Поиск";
      case "new":
        return "Новые";
      case "popular":
        return "Популярные";
      case "favorites":
        return "Избранное";
      default:
        return "Поиск";
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={`${styles.searchForm} ${className}`}
    >
      <div className={styles.searchContainer}>
        <div className={styles.inputWrapper}>
          <FiSearch className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            placeholder={
              contentType === "search"
                ? "Поиск по названию, тегам..."
                : contentType === "new"
                ? "Новые загрузки"
                : contentType === "popular"
                ? "Популярные работы"
                : "Избранное"
            }
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);

              if (v.length > 0) {
                setShowHistory(false);
              } else if (
                inputRef.current === document.activeElement &&
                searchHistory.length > 0
              ) {
                setShowHistory(true);
              }
            }}
            onFocus={() => {
              if (
                query === "" &&
                searchHistory.length > 0 &&
                contentType === "search"
              ) {
                setShowHistory(true);
              }
            }}
            className={styles.searchInput}
            disabled={contentType !== "search"}
          />

          {/* {selectedTags.length > 0 && (
            <button
              type="button"
              className={styles.tagsIndicator}
              onClick={() => setIsModalOpen(true)}
            >
              <FiTag size={14} />
              <span>{selectedTags.length}</span>
            </button>
          )} */}
        </div>

        <div className={styles.controlsContainer}>
          {/* Селектор типа контента */}
          <div
            className={styles.contentTypeSelect}
            ref={selectRef}
            onClick={() => setShowContentTypes(!showContentTypes)}
          >
            <div className={styles.selectedContentType}>
              {getContentTypeIcon(contentType)}
              <span>{getContentTypeLabel(contentType)}</span>
              <FiChevronDown
                className={`${styles.chevron} ${
                  showContentTypes ? styles.rotated : ""
                }`}
              />
            </div>

            <AnimatePresence>
              {showContentTypes && (
                <motion.div
                  className={styles.contentTypeDropdown}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {(
                    ["search", "new", "popular", "favorites"] as ContentType[]
                  ).map((type) => (
                    <div
                      key={type}
                      className={`${styles.contentTypeOption} ${
                        contentType === type ? styles.active : ""
                      }`}
                      onClick={() => switchContentType(type)}
                    >
                      {getContentTypeIcon(type)}
                      <span>{getContentTypeLabel(type)}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Кнопка поиска (только для search) */}
          {contentType === "search" && (
            <motion.button
              type="submit"
              className={styles.searchButton}
              onClick={handleSearch}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Поиск
            </motion.button>
          )}

          {/* Кнопка тегов */}
          <motion.button
            type="button"
            className={styles.tagsButton}
            onClick={() => setIsModalOpen(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <FiTag size={18} />
            {selectedTags.length > 0 && <span>{selectedTags.length}</span>}
          </motion.button>
        </div>

        <TagFilter isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

        {/* История поиска (только для search) */}
        <AnimatePresence>
          {showHistory &&
            searchHistory.length > 0 &&
            contentType === "search" && (
              <motion.div
                className={styles.historyDropdown}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className={styles.historyHeader}>
                  <FiClock className={styles.historyIcon} />
                  <span>Недавние запросы</span>
                  <button
                    className={styles.clearHistoryButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchHistory([]);
                      localStorage.removeItem("searchHistory");
                    }}
                  >
                    Очистить
                  </button>
                </div>
                <ul className={styles.historyList}>
                  {searchHistory.map((item, index) => (
                    <motion.li
                      key={index}
                      className={styles.historyItem}
                      onClick={() => handleHistoryItemClick(item)}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <span className={styles.historyText}>{item}</span>
                      <button
                        className={styles.removeHistoryButton}
                        onClick={(e) => handleRemoveHistoryItem(e, item)}
                        aria-label="Удалить из истории"
                      >
                        <FiX size={14} />
                      </button>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}
        </AnimatePresence>
      </div>

      {/* Выбранные теги (для всех режимов) */}
      {/* {selectedTags.length > 0 && (
        <div className={styles.selectedTagsContainer}>
          <div className={styles.selectedTagsList}>
            {selectedTags.map((tag) => (
              <motion.span
                key={`${tag.id}:${tag.type}`}
                className={styles.selectedTag}
                onClick={() => {
                  setSelectedTags(
                    selectedTags.filter(
                      (t) => !(t.id === tag.id && t.type === tag.type)
                    )
                  );
                }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {tag.name}
                <span className={styles.removeTag}>×</span>
              </motion.span>
            ))}
          </div>
        </div>
      )} */}
    </form>
  );
};

export default SearchInput;
