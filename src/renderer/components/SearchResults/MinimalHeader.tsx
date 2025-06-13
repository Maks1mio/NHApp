// MinimalHeader.tsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiInfo, FiChevronDown } from "react-icons/fi";
import Tooltip from "../ui/Tooltip";
import * as styles from "./SearchResults.module.scss";
import { FaRedo } from "react-icons/fa";
import { RecStats } from "./SearchResultsRecommendations";
import { motion, AnimatePresence } from "framer-motion"; // Предполагается импорт Framer Motion

interface MinimalHeaderProps {
  sortOptions: { value: string; label: string; icon: React.ReactNode }[];
  defaultSort: string;
  onSortChange: (sort: string) => void;
  onRefresh: () => void;
  loading: boolean;
  showInfo?: boolean;
  stats?: RecStats;
  disabled?: boolean;
}

const MinimalHeader: React.FC<MinimalHeaderProps> = ({
  sortOptions,
  defaultSort,
  onSortChange,
  onRefresh,
  loading,
  showInfo = false,
  stats,
  disabled = false,
}) => {
  const { search } = useLocation();
  const navigate = useNavigate();
  const qp = new URLSearchParams(search);
  const sortFromURL = qp.get("sort") || defaultSort;
  const [sortState, setSortState] = useState(sortFromURL);
  const [showSorts, setShowSorts] = useState(false);

  useEffect(() => {
    setSortState(sortFromURL);
  }, [sortFromURL]);

  const handleSortChange = (value: string) => {
    if (value === sortState) return;
    setSortState(value);
    onSortChange(value);
    qp.set("sort", value);
    qp.set("page", "1"); // Сбрасываем на первую страницу при изменении сортировки
    navigate(`?${qp.toString()}`);
    setShowSorts(false); // Закрываем выпадающий список после выбора
  };

  const infoRef = React.useRef<HTMLDivElement>(null);
  const [tipOpen, setTipOpen] = useState(false);

  const TooltipBody = () => {
    if (!stats) return null;
    return (
      <div
        className={styles.tooltipInner}
        onMouseEnter={() => setTipOpen(true)}
        onMouseLeave={() => setTipOpen(false)}
      >
        <h4>Recommendation Algorithm</h4>
        <b>Tag Weights</b>
        <ul>
          {Object.entries(stats.weights).map(([k, v]) => (
            <li key={k}>
              {k}: <em>{v}</em>
            </li>
          ))}
        </ul>
        <b>Top Characters</b>
        <ul>
          {stats.topCharacters.map((t) => (
            <li key={t.name}>
              {t.name} — <em>{t.count}</em>
            </li>
          ))}
        </ul>
        {!!stats.extraCharacters.length && (
          <>
            <b>More Characters</b>
            <ul>
              {stats.extraCharacters.map((t) => (
                <li key={t.name}>
                  {t.name} — <em>{t.count}</em>
                </li>
              ))}
            </ul>
          </>
        )}
        <b>Top Artists</b>
        <ul>
          {stats.topArtists.map((t) => (
            <li key={t.name}>
              {t.name} — <em>{t.count}</em>
            </li>
          ))}
        </ul>
        {!!stats.extraArtists.length && (
          <>
            <b>More Artists</b>
            <ul>
              {stats.extraArtists.map((t) => (
                <li key={t.name}>
                  {t.name} — <em>{t.count}</em>
                </li>
              ))}
            </ul>
          </>
        )}
        <b>Top Tags</b>
        <ul>
          {stats.topTags.map((t) => (
            <li key={t.name}>
              {t.name} — <em>{t.count}</em>
            </li>
          ))}
        </ul>
      </div>
    );
  };
  
  const icon = (sort: string) => {
    const option = sortOptions.find((o) => o.value === sort);
    return option?.icon || null;
  };

  return (
    <div className={styles.minimalHeader}>
      <div className={styles.sortControls}>
        <div
          className={styles.contentTypeSelect}
          onClick={() => setShowSorts(!showSorts)}
        >
          <div className={styles.selectedContentType}>
            {icon(sortState)}
            <span className={styles.badgeContainer}>
              {sortOptions.find((o) => o.value === sortState)?.label}
            </span>
            <FiChevronDown
              className={`${styles.chevron} ${showSorts ? styles.rotated : ""}`}
            />
          </div>

          <AnimatePresence>
            {showSorts && (
              <motion.div
                className={styles.contentTypeDropdown}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
              >
                {sortOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`${styles.contentTypeOption} ${
                      sortState === option.value ? styles.active : ""
                    }`}
                    onClick={() => handleSortChange(option.value)}
                  >
                    {icon(option.value)}
                    <span className={styles.badgeContainer}>
                      {option.label}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          className={styles.refreshButton}
          disabled={loading || disabled}
          onClick={onRefresh}
        >
          <FaRedo
            className={`${styles.refreshIcon} ${loading ? styles.spin : ""}`}
          />
        </button>
        {showInfo && stats && (
          <>
            <div
              ref={infoRef}
              className={styles.infoWrapper}
              onMouseEnter={() => setTipOpen(true)}
              onMouseLeave={() => setTipOpen(false)}
            >
              <FiInfo className={styles.infoIcon} />
            </div>
            <Tooltip anchorEl={infoRef.current} open={tipOpen}>
              <TooltipBody />
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
};

export default MinimalHeader;