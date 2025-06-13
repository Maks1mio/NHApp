import React, { useState, useMemo, useCallback } from "react";
import { useTagFilter } from "../../../context/TagFilterContext";
import { FixedSizeList as List } from "react-window";
import { FiX, FiSearch, FiArrowLeft } from "react-icons/fi";
import * as s from "./TagFilter.module.scss";
import { useTags, Tag, TagsByCategory } from "./useTags";
import { useIsMobile } from "../../../hooks/useIsMobile";

const CATEGORIES = [
  { key: "tags", label: "Tags" },
  { key: "artists", label: "Artists" },
  { key: "characters", label: "Characters" },
  { key: "parodies", label: "Parodies" },
  { key: "groups", label: "Groups" },
] as const;

const TAGS_PER_ROW = 4;
const MOBILE_TAGS_PER_ROW = 2;

interface TagFilterProps {
  isOpen: boolean;
  onClose: () => void;
}

const TagFilter: React.FC<TagFilterProps> = ({ isOpen, onClose }) => {
  const isMobile = useIsMobile(900);
  const { selectedTags, setSelectedTags } = useTagFilter();
  const tagsByCategory = useTags();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<keyof TagsByCategory>("tags");
  // Локальное состояние для временного хранения выбранных тегов
  const [tempSelectedTags, setTempSelectedTags] = useState<Tag[]>(selectedTags);

  // Синхронизация локальных тегов с глобальным контекстом при закрытии
  const handleClose = useCallback(() => {
    setSelectedTags(tempSelectedTags); // Применяем теги в контекст
    onClose(); // Закрываем модалку
  }, [tempSelectedTags, setSelectedTags, onClose]);

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
    const tagsPerRow = isMobile ? MOBILE_TAGS_PER_ROW : TAGS_PER_ROW;
    const result = [];
    for (let i = 0; i < sortedFilteredTags.length; i += tagsPerRow) {
      result.push(sortedFilteredTags.slice(i, i + tagsPerRow));
    }
    return result;
  }, [sortedFilteredTags, isMobile]);

  const handleTagClick = useCallback(
    (tag: Tag) => {
      const isSelected = tempSelectedTags.some(
        (t) => t.id === tag.id && t.type === tag.type
      );
      if (isSelected) {
        setTempSelectedTags(
          tempSelectedTags.filter((t) => !(t.id === tag.id && t.type === tag.type))
        );
      } else {
        setTempSelectedTags([...tempSelectedTags, tag]);
      }
    },
    [tempSelectedTags]
  );

  const Row = ({
    index,
    style: rowStyle,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const tagsInRow = rows[index];
    const tagsPerRow = isMobile ? MOBILE_TAGS_PER_ROW : TAGS_PER_ROW;
    return (
      <div style={rowStyle} className={s.tagsRow}>
        {tagsInRow.map((tag) => {
          const isSelected = tempSelectedTags.some(
            (t) => t.id === tag.id && t.type === tag.type
          );
          return (
            <button
              key={`${tag.id}:${tag.type}`}
              className={`${s.tag} ${isSelected ? s.selected : ""}`}
              onClick={() => handleTagClick(tag)}
              style={{ flex: `1 1 calc(${100 / tagsPerRow}% - 12px)` }}
            >
              <span className={s.tagName}>{tag.name}</span>
              <span className={s.tagCount}>{tag.count}</span>
            </button>
          );
        })}
        {Array.from({ length: tagsPerRow - tagsInRow.length }).map((_, i) => (
          <div
            key={i}
            className={s.tag}
            style={{
              visibility: "hidden",
              flex: `1 1 calc(${100 / tagsPerRow}% - 12px)`,
            }}
          />
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className={s.overlay} onClick={handleClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        {isMobile && (
          <header className={s.header}>
            <button type="button" className={s.closeButton} onClick={handleClose}>
              <FiArrowLeft />
            </button>
            <h2 className={s.title}>Tag Filters</h2>
          </header>
        )}

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

        {tempSelectedTags.length > 0 && (
          <section className={s.selectedTagsSection}>
            <div className={s.selectedTagsHeader}>
              <span>Selected ({tempSelectedTags.length})</span>
              <button
                className={s.clearAllButton}
                onClick={() => setTempSelectedTags([])}
              >
                Clear all
              </button>
            </div>
            <div className={s.selectedTagsList}>
              {tempSelectedTags.map((tag) => (
                <button
                  key={`${tag.id}:${tag.type}`}
                  className={s.selectedTag}
                  onClick={() => handleTagClick(tag)}
                >
                  {tag.name}
                  <span className={s.removeTag}>×</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className={s.searchContainer}>
          <div className={s.searchWrapper}>
            <FiSearch className={s.searchIcon} />
            <input
              type="text"
              className={s.searchInput}
              placeholder="Search tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className={s.clearSearch}
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <FiX size={16} />
              </button>
            )}
          </div>
        </div>

        <div className={s.tagsContainer}>
          {rows.length > 0 ? (
            <List
              height={1400}
              style={{
                height: "100%",
                width: "-webkit-fill-available",
                overflow: "auto",
                willChange: "transform",
                position: "absolute",
                left: "25px",
                right: "25px",
              }}
              itemCount={rows.length}
              itemSize={isMobile ? 60 : 52}
              width="100%"
            >
              {Row}
            </List>
          ) : (
            <div className={s.noResults}>
              No tags found
              {search && (
                <button
                  className={s.resetSearchButton}
                  onClick={() => setSearch("")}
                >
                  Reset search
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TagFilter;