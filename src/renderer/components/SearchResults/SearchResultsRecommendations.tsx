import React, { useCallback, useEffect, useState, useRef } from "react";
import { FiInfo } from "react-icons/fi";
import * as styles from "./SearchResults.module.scss";
import BookCard, { Book } from "../BookCard";
import { wsClient } from "../../../wsClient";
import Tooltip from "../ui/Tooltip";
import { useTagFilter } from "../../../context/TagFilterContext";

const LS_FAVORITES_KEY = "bookFavorites";
const LS_PREFERENCES_KEY = "recommendationPreferences";
const PER_PAGE = 100;
const TODAY_ISO = new Date().toISOString().slice(0, 10);
const isToday = (iso: string) => iso.startsWith(TODAY_ISO);

type TagStat = { name: string; count: number };
interface RecStats {
  weights: Record<string, number>;
  topCharacters: TagStat[];
  topArtists: TagStat[];
  topTags: TagStat[];
  extraCharacters: TagStat[];
  extraArtists: TagStat[];
}
interface BookWithTags extends Book {
  sharedTags?: string[];
}
interface Preferences {
  prioritizeRecency: boolean;
  prioritizeArtists: boolean;
  prioritizeCharacters: boolean;
  diversityLevel: number;
}

const SearchResultsRecommendations: React.FC = () => {
  const { selectedTags } = useTagFilter();
  const [favIds, setFavIds] = useState<number[]>(() =>
    JSON.parse(localStorage.getItem(LS_FAVORITES_KEY) ?? "[]")
  );
  useEffect(() => {
    const h = (e: StorageEvent) => {
      if (e.key === LS_FAVORITES_KEY) {
        setFavIds(JSON.parse(e.newValue ?? "[]"));
      }
    };
    addEventListener("storage", h);
    return () => removeEventListener("storage", h);
  }, []);

  const toggleFavorite = (id: number, add: boolean) => {
    setFavIds((prev) => {
      const next = add ? [...prev, id] : prev.filter((i) => i !== id);
      localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  };

  const [preferences, setPreferences] = useState<Preferences>(() =>
    JSON.parse(
      localStorage.getItem(LS_PREFERENCES_KEY) ??
        JSON.stringify({
          prioritizeRecency: false,
          prioritizeArtists: true,
          prioritizeCharacters: true,
          diversityLevel: 1,
        })
    )
  );

  const [books, setBooks] = useState<BookWithTags[]>([]);
  const [stats, setStats] = useState<RecStats | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotal] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    message: string;
    percent: number;
  } | null>(null);

  const fetchPage = useCallback(
    (p: number) => {
      if (!favIds.length) return;
      setLoading(true);
      setError(null);

      const unsub = wsClient.subscribe((res) => {
        if (res.type === "recommendations-progress") {
          setProgress({
            percent: res.percent ?? 0,
            message: res.message ?? "",
          });
          return;
        }
        if (res.type === "error") {
          setError(res.message);
          setLoading(false);
          return unsub();
        }
        if (res.type === "recommendations-reply") {
          setProgress(null);
          setStats(res.stats || null);
          setTotal(res.totalPages ?? 1);
          setPage(res.currentPage ?? 1);

          const inc: BookWithTags[] = res.books || [];
          const today = inc.filter((b) => isToday(b.uploaded));
          const rest = inc.filter((b) => !isToday(b.uploaded));
          const batch = [...today, ...rest];

          setBooks((prev) => {
            const seen = new Set(prev.map((b) => b.id));
            return [...prev, ...batch.filter((b) => !seen.has(b.id))];
          });
          setLoading(false);
          unsub();
        }
      });

      wsClient.send({
        type: "get-recommendations",
        sentIds: books.map((b) => b.id),
        ids: favIds,
        page: p,
        perPage: PER_PAGE,
        preferences,
        filterTags: selectedTags,
      });
    },
    [favIds, books, preferences, selectedTags]
  );

  useEffect(() => {
    setBooks([]);
    setPage(1);
    if (favIds.length) fetchPage(1);
  }, [preferences, selectedTags]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinel.current) return;
    const io = new IntersectionObserver(
      ([el]) => {
        if (el.isIntersecting && !loading && page < totalPages)
          fetchPage(page + 1);
      },
      { rootMargin: "200px" }
    );
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [loading, page, totalPages, fetchPage]);

  const infoRef = useRef<HTMLDivElement>(null);
  const [tipOpen, setTipOpen] = useState(false);

  const TooltipBody = () =>
    stats && (
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

  return (
    <div className={styles.container}>
      <header className={styles.minimalHeader}>
        <div className={styles.sortControls}>
          {stats && (
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
      </header>

      <main className={styles.mainContent}>
        {!loading && !favIds.length && <NoFavs />}

        <div className={styles.booksGrid}>
          {books.map((b) => (
            <BookCard
              key={b.id}
              book={b}
              isNew={isToday(b.uploaded)}
              isFavorite={favIds.includes(b.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>

        {loading && <Loader prog={progress} />}
        <div ref={sentinel} style={{ height: 1 }} />
        {!loading && books.length === 0 && favIds.length > 0 && <NoRecs />}
      </main>
    </div>
  );
};

const Loader: React.FC<{
  prog: { message: string; percent: number } | null;
}> = ({ prog }) => (
  <div className={styles.loadingState}>
    <div className={styles.loadingSpinner} />
    {prog && (
      <div className={styles.loadingInfo}>
        <strong>{prog.message}</strong>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${prog.percent}%` }}
          />
        </div>
      </div>
    )}
  </div>
);

const NoFavs = () => <p className={styles.emptyState}>No favorite books.</p>;
const NoRecs = () => <p className={styles.emptyState}>No recommendations.</p>;

export default SearchResultsRecommendations;
