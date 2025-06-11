import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FiSearch,
  FiClock,
  FiX,
  FiTag,
  FiStar,
  FiTrendingUp,
  FiUpload,
  FiChevronDown,
  FiHeart,
  FiShuffle,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import * as styles from "./SearchInput.module.scss";
import TagFilter from "../TagFilter";
import { useTagFilter } from "../../../context/TagFilterContext";
import { wsClient } from "../../../wsClient";

type ContentType =
  | "recommendations"
  | "search"
  | "random"
  | "new"
  | "popular"
  | "favorites";

interface SearchInputProps {
  onSearch: (query: string, type: ContentType) => void;
  className?: string;
}

interface Suggestion {
  id: number;
  title: string;
  thumbnail: string;
  pages: number;
}

const icon = (t: ContentType) =>
  t === "search" ? (
    <FiSearch />
  ) : t === "random" ? (
    <FiShuffle />
  ) : t === "new" ? (
    <FiUpload />
  ) : t === "popular" ? (
    <FiTrendingUp />
  ) : t === "favorites" ? (
    <FiStar />
  ) : (
    <FiHeart />
  );

const label = (t: ContentType) =>
  t === "recommendations"
    ? "Recommendations"
    : t === "new"
    ? "New"
    : t === "popular"
    ? "Popular"
    : t === "favorites"
    ? "Favorites"
    : t === "random"
    ? "Random"
    : "Search";

const SearchInput: React.FC<SearchInputProps> = ({ onSearch, className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const { selectedTags } = useTagFilter();

  const [query, setQuery] = useState("");
  const [type, setType] = useState<ContentType>(
    (qs.get("type") as ContentType) || "search"
  );
  const [history, setHistory] = useState<string[]>([]);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const [focused, setFocused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const debRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("searchHistory");
    if (stored) setHistory(JSON.parse(stored));
  }, []);

  useEffect(() => {
    onSearch(query, type);
  }, [selectedTags, type]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!formRef.current?.contains(e.target as Node)) {
        setShowTypes(false);
        setResults([]);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  const fetchSuggestions = useCallback(
    (q: string) => {
      if (!q.trim() && selectedTags.length === 0) {
        setResults([]);
        return;
      }

      const unsub = wsClient.subscribe((msg) => {
        if (msg.type === "search-results-reply") {
          const list = (msg.books || []).slice(0, 6).map((b: any) => ({
            id: b.id,
            title: b.title?.pretty || b.title?.english || "",
            thumbnail: b.thumbnail,
            pages: b.pagesCount,
          }));
          setResults(list);
          unsub();
        }
      });

      wsClient.send({
        type: "search-books",
        query: q,
        page: 1,
        perPage: 6,
        sort: "",
        filterTags: selectedTags,
        contentType: "search",
      });
    },
    [selectedTags]
  );

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    if (type !== "search") {
      setResults([]);
      return;
    }
    debRef.current = setTimeout(() => fetchSuggestions(query), 800);
    return () => debRef.current && clearTimeout(debRef.current);
  }, [query, selectedTags, type, fetchSuggestions]);

  const addHistory = (q: string) => {
    const upd = [
      q,
      ...history.filter((h) => h.toLowerCase() !== q.toLowerCase()),
    ].slice(0, 100);
    setHistory(upd);
    localStorage.setItem("searchHistory", JSON.stringify(upd));
  };

  const clearDropdown = () => {
    setShowTypes(false);
    setResults([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (/^\d+$/.test(trimmed)) {
      clearDropdown();
      setFocused(false);
      navigate(`/book/${trimmed}`);
      return;
    }
    executeSearch(trimmed);
  };

  const executeSearch = (q: string, saveHist = true) => {
    clearDropdown();
    setFocused(false);
    inputRef.current?.blur();
    setQuery(q);
    if (saveHist && q) addHistory(q);
    navigate(`/search?q=${encodeURIComponent(q)}&type=search`);
    onSearch(q, "search");
  };

  const openRandom = () => {
    clearDropdown();
    setQuery("");
    wsClient.once("random-book-reply", (msg) => {
      if (msg.id) navigate(`/book/${msg.id}`);
    });
    wsClient.send({ type: "get-random-book" });
  };

  const qLower = query.trim().toLowerCase();
  const histList = qLower
    ? history.filter((h) => h.toLowerCase().includes(qLower))
    : history;

  const showDropdown =
    focused && type === "search" && (results.length || histList.length);

  return (
    <form
      ref={formRef}
      className={`${styles.searchForm} ${className}`}
      onSubmit={handleSubmit}
    >
      <div className={styles.searchContainer}>
        <div className={styles.inputWrapper}>
          <FiSearch className={styles.searchIcon} />
          <input
            ref={inputRef}
            value={query}
            disabled={type !== "search"}
            placeholder={
              type === "search" ? "Search by title or ID…" : label(type)
            }
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              setTimeout(clearDropdown, 100);
            }}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.controlsContainer}>
          <div
            className={styles.contentTypeSelect}
            onClick={() => setShowTypes(!showTypes)}
          >
            <div className={styles.selectedContentType}>
              {icon(type)}
              <span className={styles.badgeContainer}>
                {label(type)}
                {type === "recommendations" && (
                  <span className={styles.betaBadge}>BETA</span>
                )}
              </span>
              <FiChevronDown
                className={`${styles.chevron} ${
                  showTypes ? styles.rotated : ""
                }`}
              />
            </div>

            <AnimatePresence>
              {showTypes && (
                <motion.div
                  className={styles.contentTypeDropdown}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  {(
                    [
                      "recommendations",
                      "search",
                      "random",
                      "new",
                      "popular",
                      "favorites",
                    ] as ContentType[]
                  ).map((t) => (
                    <div
                      key={t}
                      className={`${styles.contentTypeOption} ${
                        type === t ? styles.active : ""
                      }`}
                      onClick={() => {
                        if (t === "random") {
                          openRandom();
                          return;
                        }
                        setType(t);
                        clearDropdown();
                        setQuery("");
                        navigate(`/search?type=${t}`);
                        onSearch("", t);
                      }}
                    >
                      {icon(t)}
                      <span className={styles.badgeContainer}>
                        {label(t)}
                        {t === "recommendations" && (
                          <span className={styles.badgeInline}>BETA</span>
                        )}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {type === "search" && (
            <motion.button
              type="submit"
              className={styles.searchButton}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Search
            </motion.button>
          )}

          <motion.button
            type="button"
            className={styles.tagsButton}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setTagsOpen(true)}
          >
            <FiTag />
            <span>{selectedTags.length}</span>
          </motion.button>
        </div>

        <TagFilter isOpen={tagsOpen} onClose={() => setTagsOpen(false)} />

        <AnimatePresence>
          {showDropdown && (
            <motion.div
              className={styles.unifiedDropdown}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {histList.length > 0 && (
                <>
                  <div className={styles.sectionHeaderRow}>
                    <span>History</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setHistory([]);
                        localStorage.removeItem("searchHistory");
                      }}
                    >
                      clear
                    </button>
                  </div>
                  {histList.map((h) => (
                    <div
                      key={h}
                      className={styles.historyRow}
                      onClick={() => executeSearch(h)}
                    >
                      <FiClock size={14} />
                      <span>{h}</span>
                      <button
                        className={styles.removeBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHistory((prev) => prev.filter((x) => x !== h));
                          localStorage.setItem(
                            "searchHistory",
                            JSON.stringify(histList.filter((x) => x !== h))
                          );
                        }}
                      >
                        <FiX size={12} />
                      </button>
                    </div>
                  ))}
                </>
              )}

              {results.length > 0 && (
                <>
                  <div className={styles.sectionHeader}>Results</div>
                  {results.map((r) => (
                    <div
                      key={r.id}
                      className={styles.resultRow}
                      onClick={() => {
                        executeSearch(r.title);
                        navigate(`/book/${r.id}`);
                      }}
                    >
                      <img
                        src={r.thumbnail}
                        alt={r.title}
                        className={styles.thumb}
                      />
                      <div className={styles.resultMeta}>
                        <span>{r.title}</span>
                        <span className={styles.light}>{r.pages} pages</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
};

export default SearchInput;
