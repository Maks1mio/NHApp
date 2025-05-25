import React, { useState, useEffect, useRef } from "react";
import { FiSearch, FiClock, FiX } from "react-icons/fi";
import * as styles from "./SearchInput.module.scss";

interface SearchInputProps {
  onSearch: (query: string) => void;
  className?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({ onSearch, className }) => {
  const [query, setQuery] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Загрузка истории из localStorage
  useEffect(() => {
    const history = localStorage.getItem("searchHistory");
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  }, []);

  // Обработчик отправки формы
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      onSearch(trimmedQuery);
      addToHistory(trimmedQuery);
      setShowHistory(false);
      setQuery("");
    }
  };

  // Добавление запроса в историю (без дубликатов)
  const addToHistory = (searchQuery: string) => {
    const updatedHistory = [
      searchQuery,
      ...searchHistory.filter(
        (item) => item.toLowerCase() !== searchQuery.toLowerCase()
      ),
    ].slice(0, 5);

    setSearchHistory(updatedHistory);
    localStorage.setItem("searchHistory", JSON.stringify(updatedHistory));
  };

  // Клик по элементу истории
  const handleHistoryItemClick = (item: string) => {
    setQuery(item);
    onSearch(item);
    setShowHistory(false);
    inputRef.current?.blur();
  };

  // Удаление элемента истории
  const handleRemoveHistoryItem = (e: React.MouseEvent, item: string) => {
    e.stopPropagation();
    const updatedHistory = searchHistory.filter((i) => i !== item);
    setSearchHistory(updatedHistory);
    localStorage.setItem("searchHistory", JSON.stringify(updatedHistory));
  };

  // Обработчик клика вне компонента
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={`${styles.searchForm} ${className}`}
    >
      <div className={styles.searchContainer}>
        <FiSearch className={styles.searchIcon} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Поиск..."
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);

            // Если ввели хоть что-то — скрываем историю
            if (v.length > 0) {
              setShowHistory(false);
            }
            // Если очистили поле и всё ещё в фокусе — показываем историю
            else if (
              inputRef.current === document.activeElement &&
              searchHistory.length > 0
            ) {
              setShowHistory(true);
            }
          }}
          onFocus={() => {
            // Показываем историю только если поле пустое
            if (query === "" && searchHistory.length > 0) {
              setShowHistory(true);
            }
          }}
          className={styles.searchInput}
        />

        {showHistory && searchHistory.length > 0 && (
          <div className={styles.historyDropdown}>
            <div className={styles.historyHeader}>
              <FiClock className={styles.historyIcon} />
              <span>История поиска</span>
            </div>
            <ul className={styles.historyList}>
              {searchHistory.map((item, index) => (
                <li
                  key={index}
                  className={styles.historyItem}
                  onClick={() => handleHistoryItemClick(item)}
                >
                  <span className={styles.historyText}>{item}</span>
                  <button
                    className={styles.removeHistoryButton}
                    onClick={(e) => handleRemoveHistoryItem(e, item)}
                    aria-label="Удалить из истории"
                  >
                    <FiX size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </form>
  );
};

export default SearchInput;
