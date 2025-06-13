import React, { useCallback, useEffect, useState, useRef } from "react";
import { FiInfo } from "react-icons/fi";
import * as styles from "./SearchResults.module.scss";
import BookCard, { Book } from "../BookCard";
import { wsClient } from "../../../wsClient";
import Tooltip from "../ui/Tooltip";
import { useTagFilter } from "../../../context/TagFilterContext";
import MinimalHeader from "./MinimalHeader";
import {
  Loading,
  NoFavorites,
  NoRecommendations,
  StateBlock,
} from "./SearchResultStates";

const LS_FAVORITES_KEY = "bookFavorites";
const LS_PREFERENCES_KEY = "recommendationPreferences";
const PER_PAGE = 100;
const TODAY_ISO = new Date().toISOString().slice(0, 10);
const isToday = (iso: string) => iso.startsWith(TODAY_ISO);

interface RecStats {
  weights: Record<string, number>;
  topCharacters: TagStat[];
  topArtists: TagStat[];
  topTags: TagStat[];
  extraCharacters: TagStat[];
  extraArtists: TagStat[];
}

export { RecStats };

type TagStat = { name: string; count: number };
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
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
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
  const [currentPage, setCurrentPage] = useState(1);
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
          setError(res.message || "Failed to load recommendations");
          setLoading(false);
          return unsub();
        }
        if (res.type === "recommendations-reply") {
          setStats((res.stats as RecStats) || null);
          setProgress(null);
          setStats(res.stats || null);
          setTotal(res.totalPages ?? 1);
          setCurrentPage(res.currentPage ?? p);

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
    setCurrentPage(1);
    if (favIds.length) fetchPage(1);
  }, [favIds, preferences, selectedTags]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinel.current) return;
    const io = new IntersectionObserver(
      ([el]) => {
        if (el.isIntersecting && !loading && currentPage < totalPages)
          fetchPage(currentPage + 1);
      },
      { rootMargin: "200px" }
    );
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [loading, currentPage, totalPages, fetchPage]);

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

  const onSortChange = () => {};
  const onRefresh = () => {
    setBooks([]);
    setCurrentPage(1);
    if (favIds.length) fetchPage(1);
  };

  return (
    <div className={styles.container}>
      <main className={styles.mainContent}>
        {error && (
          <StateBlock
            icon="⚠️"
            title="Error"
            description={error}
            retry={() => {
              setBooks([]);
              setCurrentPage(1);
              if (favIds.length) fetchPage(1);
            }}
          />
        )}
        {loading && <Loading progress={progress} />}
        {!loading && !error && (
          <>
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
            {books.length === 0 && favIds.length > 0 && (
              <StateBlock icon="📚" description="No recommendations." />
            )}
            {!favIds.length && (
              <StateBlock icon="📚" description="No favorite books." />
            )}
            <div ref={sentinel} style={{ height: 1 }} />
          </>
        )}
      </main>
      <MinimalHeader
        sortOptions={[]}
        defaultSort=""
        onSortChange={onSortChange}
        onRefresh={onRefresh}
        loading={loading}
        showInfo={true}
        stats={stats}
        disabled={!favIds.length}
      />
    </div>
  );
};

export default SearchResultsRecommendations;
