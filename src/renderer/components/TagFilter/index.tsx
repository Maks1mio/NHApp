import React, { useState, useMemo, useCallback } from "react";
import { useTagFilter } from "../../../context/TagFilterContext";
import { FixedSizeList as List } from "react-window";
import { motion, AnimatePresence } from "framer-motion";
import * as s from "./TagFilter.module.scss";
import { useTags, Tag, TagsByCategory } from "./useTags";

const CATEGORIES = [
  { key: "tags", label: "Tags" },
  { key: "artists", label: "Artists" },
  { key: "characters", label: "Characters" },
  { key: "parodies", label: "Parodies" },
  { key: "groups", label: "Groups" },
] as const;

const TAGS_PER_ROW = 3;

interface TagFilterProps {
  isOpen: boolean;
  onClose: () => void;
}

const TagFilter: React.FC<TagFilterProps> = ({ isOpen, onClose }) => {
  const { selectedTags, setSelectedTags } = useTagFilter();
  const tagsByCategory = useTags();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<keyof TagsByCategory>("tags");

  const sortedFilteredTags = useMemo(() => {
    const tags = tagsByCategory[activeTab] || [];
    const filtered = search.trim()
      ? tags.filter((tag) =>
          tag.name.toLowerCase().includes(search.trim().toLowerCase())
        )
      : tags;
    return [...filtered].sort((a, b) => (b.count || 0) - (a.count || 0));
  }, [tagsByCategory, activeTab, search]);

  const rows = useMemo(() => {
    const result = [];
    for (let i = 0; i < sortedFilteredTags.length; i += TAGS_PER_ROW) {
      result.push(sortedFilteredTags.slice(i, i + TAGS_PER_ROW));
    }
    return result;
  }, [sortedFilteredTags]);

  const handleTagClick = useCallback(
    (tag: Tag) => {
      const isSelected = selectedTags.some(
        (t) => t.id === tag.id && t.type === tag.type
      );
      if (isSelected) {
        setSelectedTags(
          selectedTags.filter((t) => !(t.id === tag.id && t.type === tag.type))
        );
      } else {
        setSelectedTags([...selectedTags, tag]);
      }
    },
    [selectedTags, setSelectedTags]
  );

  const Row = ({
    index,
    style: rowStyle,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const tagsInRow = rows[index];
    return (
      <div style={rowStyle} className={s.tagsRow}>
        {tagsInRow.map((tag) => {
          const isSelected = selectedTags.some(
            (t) => t.id === tag.id && t.type === tag.type
          );
          return (
            <motion.div
              key={`${tag.id}:${tag.type}`}
              className={`${s.tag} ${isSelected ? s.sel : ""}`}
              onClick={() => handleTagClick(tag)}
              whileHover={{ scale: 1 }}
              whileTap={{ scale: 0.98 }}
              style={{ flex: "1 1 calc(33.33% - 8px)" }}
            >
              <span className={s.name}>{tag.name}</span>
              <span className={s.count}>{tag.count}</span>
            </motion.div>
          );
        })}
        {Array.from({ length: TAGS_PER_ROW - tagsInRow.length }).map((_, i) => (
          <div
            key={i}
            className={s.tag}
            style={{ visibility: "hidden", flex: "1 1 calc(33.33% - 8px)" }}
          />
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className={s.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={s.modal}
          onClick={(e) => e.stopPropagation()}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          <header className={s.header}>
            <nav className={s.tabs}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  className={`${s.tab} ${activeTab === c.key ? s.active : ""}`}
                  onClick={() => setActiveTab(c.key as keyof TagsByCategory)}
                >
                  {c.label}
                </button>
              ))}
            </nav>
            <div className={s.searchWrapper}>
              <input
                type="text"
                className={s.search}
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className={s.clearSearch} onClick={() => setSearch("")}>
                  ×
                </button>
              )}
            </div>
            <button className={s.close} onClick={onClose}>
              ✕
            </button>
          </header>

          {!!selectedTags.length && (
            <section 
              className={s.selected}
            >
              <div className={s.selectedChips}>
                {selectedTags.map((tag) => (
                  <motion.button
                    key={`${tag.id}:${tag.type}`}
                    className={s.chip}
                    onClick={() => handleTagClick(tag)}
                    whileHover={{ scale: 1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {tag.name} <span className={s.chipX}>×</span>
                  </motion.button>
                ))}
              </div>
              <button className={s.clearAll} onClick={() => setSelectedTags([])}>
                Clear all
              </button>
            </section>
          )}

          <div className={s.availableTagsContainer}>
            {rows.length > 0 ? (
              <List
                height={400}
                itemCount={rows.length}
                itemSize={52}
                width="100%"
              >
                {Row}
              </List>
            ) : (
              <motion.div 
                className={s.noResults}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                Nothing found
                <button className={s.resetSearch} onClick={() => setSearch("")}>
                  Reset search
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default TagFilter;