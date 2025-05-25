import React, { useState, useEffect, useRef } from 'react';
import { FiFilter, FiX } from 'react-icons/fi';
import * as styles from './TagFilter.module.scss';

interface Tag {
  id:    number;
  type:  string;
  name:  string;
  count: number;
}

interface TagFilterProps {
  onTagSelect: (tags: string[]) => void;
}

const TagFilter: React.FC<TagFilterProps> = ({ onTagSelect }) => {
  const [isOpen,       setIsOpen]       = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [tagCategories, setTagCategories] = useState<Record<string, Tag[]>>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  // При первом открытии дропдауна запрашиваем теги по WS
  useEffect(() => {
    if (!isOpen || Object.keys(tagCategories).length > 0) return;

    setLoading(true);
    const ws = new WebSocket('ws://localhost:8080');
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: 'get-tags' }));

    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'tags-reply' && Array.isArray(msg.tags)) {
        // группируем по type
        const cats: Record<string, Tag[]> = {};
        msg.tags.forEach((t: Tag) => {
          cats[t.type] = cats[t.type] || [];
          cats[t.type].push(t);
        });
        setTagCategories(cats);
      }
      setLoading(false);
      ws.close();
    };

    ws.onerror = () => {
      console.error("WS error loading tags");
      setLoading(false);
      ws.close();
    };

    return () => ws.close();
  }, [isOpen, tagCategories]);

  const toggleTag = (name: string) => {
    const next = selectedTags.includes(name)
      ? selectedTags.filter(t => t !== name)
      : [...selectedTags, name];
    setSelectedTags(next);
    onTagSelect(next);
  };

  const clearAll = () => {
    setSelectedTags([]);
    onTagSelect([]);
  };

  return (
    <div className={styles.tagFilterContainer}>
      <button
        className={`${styles.filterButton} ${selectedTags.length > 0 ? styles.active : ''}`}
        onClick={() => setIsOpen(o => !o)}
        aria-label="Фильтр по тегам"
      >
        <FiFilter />
        {selectedTags.length > 0 && <span className={styles.badge}>{selectedTags.length}</span>}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownHeader}>
            <h3>Фильтр по тегам</h3>
            <button className={styles.closeButton} onClick={() => setIsOpen(false)}>
              <FiX />
            </button>
          </div>

          {selectedTags.length > 0 && (
            <div className={styles.selectedTags}>
              <div className={styles.selectedTagsHeader}>
                <span>Выбранные теги:</span>
                <button className={styles.clearButton} onClick={clearAll}>
                  Очистить
                </button>
              </div>
              <div className={styles.selectedTagsList}>
                {selectedTags.map(tag => (
                  <span key={tag} className={styles.selectedTag} onClick={() => toggleTag(tag)}>
                    {tag} <FiX size={12} />
                  </span>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className={styles.loading}>Загрузка тегов...</div>
          ) : (
            <div className={styles.tagCategories}>
              {Object.entries(tagCategories).map(([cat, tags]) => (
                <div key={cat} className={styles.category}>
                  <h4 className={styles.categoryTitle}>{getCategoryName(cat)}</h4>
                  <div className={styles.tagsList}>
                    {tags.map(t => (
                      <button
                        key={t.id}
                        className={`${styles.tag} ${selectedTags.includes(t.name) ? styles.selected : ''}`}
                        onClick={() => toggleTag(t.name)}
                      >
                        {t.name} ({t.count})
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function getCategoryName(cat: string): string {
  const map: Record<string, string> = {
    tag:       'Теги',
    artist:    'Художники',
    character: 'Персонажи',
    parody:    'Пародии',
    group:     'Группы',
    category:  'Категории',
    language:  'Язык',
  };
  return map[cat] || cat;
}

export default TagFilter;
