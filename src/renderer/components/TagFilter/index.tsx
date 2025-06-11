import React, { useState, useMemo, useCallback } from "react";
import { useTagFilter } from "../../../context/TagFilterContext";
import { FixedSizeList as List } from "react-window";
import { motion, AnimatePresence } from "framer-motion";
import * as style from "./TagFilter.module.scss";
import { useTags, Tag, TagsByCategory } from "./useTags";

const CATEGORIES = [
  { key: "tags", label: "Tags", icon: "🏷️" },
  { key: "artists", label: "Artists", icon: "👨‍🎨" },
  { key: "characters", label: "Characters", icon: "👤" },
  { key: "parodies", label: "Parodies", icon: "🎭" },
  { key: "groups", label: "Groups", icon: "👥" },
];

const TAGS_PER_ROW = 3;

interface TagFilterProps {
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

const TagFilter: React.FC<TagFilterProps> = ({ isOpen, onClose, children }) => {
  const tagsByCategory = useTags();
  const { selectedTags, setSelectedTags } = useTagFilter();
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

  // Split tags into rows of 3
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

  // Row component with 3 tags
  const Row = ({
    index,
    style: rowStyle,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const tagsInRow = rows[index];
    return (
      <div style={rowStyle} className={style.tagsRow}>
        {tagsInRow.map((tag) => {
          const isSelected = selectedTags.some(
            (t) => t.id === tag.id && t.type === tag.type
          );
          return (
            <motion.div
              key={`${tag.id}:${tag.type}`}
              className={`${style.availableTag} ${
                isSelected ? style.selected : ""
              }`}
              onClick={() => handleTagClick(tag)}
              whileTap={{ scale: 0.98 }}
            >
              <span className={style.tagName}>{tag.name}</span>
              <span className={style.tagCount}>{tag.count}</span>
            </motion.div>
          );
        })}
        {/* If the row is not full, add empty divs for alignment */}
        {Array.from({ length: TAGS_PER_ROW - tagsInRow.length }).map((_, i) => (
          <div
            key={i}
            className={style.availableTag}
            style={{ visibility: "hidden" }}
          />
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={style.modalOverlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={style.modal}
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: "spring", damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className={style.modalClose} onClick={onClose}>
              ×
            </button>
            <div className={style.tagTabs}>
              {CATEGORIES.map((cat) => (
                <motion.button
                  key={cat.key}
                  className={`${style.tabBtn} ${
                    activeTab === cat.key ? style.active : ""
                  }`}
                  onClick={() => setActiveTab(cat.key as keyof TagsByCategory)}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                >
                  <span className={style.tabIcon}>{cat.icon}</span>
                  {cat.label}
                  {activeTab === cat.key && (
                    <motion.span
                      className={style.tabIndicator}
                      layoutId="tabIndicator"
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                    />
                  )}
                </motion.button>
              ))}
            </div>

            <div className={style.selectedTagsList}>
              {selectedTags.map((tag) => (
                <span
                  key={`${tag.id}:${tag.type}`}
                  className={style.selectedTag}
                  onClick={() => handleTagClick(tag)}
                >
                  {tag.name} ×
                </span>
              ))}
            </div>

            <div className={style.searchContainer}>
              <svg
                className={style.searchIcon}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M21 21L16.65 16.65"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                className={style.tagSearchInput}
                type="text"
                placeholder="Search tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className={style.clearSearch}
                  onClick={() => setSearch("")}
                  tabIndex={-1}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M18 6L6 18M6 6L18 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
            </div>

            <div className={style.availableTagsContainer}>
              {rows.length > 0 ? (
                <List
                  height={300}
                  itemCount={rows.length}
                  itemSize={48} // slightly taller to allow spacing between rows
                  width="100%"
                >
                  {Row}
                </List>
              ) : (
                <motion.div
                  className={style.noResults}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 8V12M12 16H12.01"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p>Nothing found</p>
                  <button
                    className={style.resetSearchButton}
                    onClick={() => setSearch("")}
                  >
                    Reset search
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TagFilter;
