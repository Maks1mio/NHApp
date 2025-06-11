import React, { useState, useEffect, useRef, KeyboardEvent } from "react";
import * as styles from "./searchInput.module.scss";

export interface TagSuggestion {
  tag: string;
  count: number;
}

interface Props {
  onSearch: (q: string) => void;
}

const DEBOUNCE_DELAY = 300;

const SearchInput: React.FC<Props> = ({ onSearch }) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [highlight, setHighlight] = useState<number>(-1);
  const timerRef = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const triggerSuggest = (v: string) => {
    if (!v.trim()) {
      setSuggestions([]);
      return;
    }
    window.electron.booru
      .suggest(v)
      .then((tags) => setSuggestions(tags))
      .catch(() => {
        // retry after 1 second on error
        setTimeout(() => triggerSuggest(v), 1000);
      });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setHighlight(-1);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      triggerSuggest(v);
    }, DEBOUNCE_DELAY);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSearch(query.trim());
    setSuggestions([]);
  };

  const pick = (tag: string) => {
    setQuery(tag);
    onSearch(tag);
    setSuggestions([]);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
      scrollIntoView(highlight + 1);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      scrollIntoView(highlight - 1);
    }
    if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      pick(suggestions[highlight].tag);
    }
  };

  const scrollIntoView = (index: number) => {
    const ul = listRef.current;
    const item = ul?.children[index] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  };

  return (
    <form onSubmit={handleSubmit} className={styles.searchForm}>
      <div className={styles.inputWrapper}>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          placeholder="Search by tags..."
          className={styles.searchInput}
          autoComplete="off"
        />
        <button type="submit" className={styles.searchButton}>
          🔍
        </button>
      </div>

      {suggestions.length > 0 && (
        <ul ref={listRef} className={styles.suggestionsList}>
          {suggestions.map((s, i) => (
            <li
              key={s.tag}
              className={`${styles.suggestionItem} ${
                i === highlight ? styles.highlighted : ""
              }`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => pick(s.tag)}
            >
              <span className={styles.tagText}>{s.tag}</span>
              <span className={styles.tagCount}>{s.count}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
};

export default SearchInput;