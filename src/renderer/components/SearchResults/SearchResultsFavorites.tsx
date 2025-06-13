import React, { useCallback, useEffect, useState } from "react";
import BookCard, { Book } from "../BookCard";
import Pagination from "../Pagination";
import { FiStar, FiTrendingUp } from "react-icons/fi";
import { FaRedo } from "react-icons/fa";
import * as styles from "./SearchResults.module.scss";
import { wsClient } from "../../../wsClient";
import MinimalHeader from "./MinimalHeader";
import { Loading, StateBlock } from "./SearchResultStates";

const PER_PAGE = 25;
const FAVORITES_SORT_KEY = "favoritesSortType";
const LS_FAVORITES_KEY = "bookFavorites";

type SortType = "relevance" | "popular";

const SORT_OPTS: { value: SortType; label: string; icon: React.ReactNode }[] = [
  { value: "relevance", label: "By date added", icon: <FiStar /> },
  { value: "popular", label: "By popularity", icon: <FiTrendingUp /> },
];

const SearchResultsFavorites: React.FC = () => {
  const [favIds, setFavIds] = useState<number[]>(() =>
    JSON.parse(localStorage.getItem(LS_FAVORITES_KEY) ?? "[]")
  );
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const initialSort =
    (localStorage.getItem(FAVORITES_SORT_KEY) as SortType) || "relevance";
  const [sortState, setSortState] = useState<SortType>(initialSort);

  const fetchData = useCallback(
    (p = 1, s: SortType = sortState) => {
      if (favIds.length === 0) {
        setBooks([]);
        setTotalPages(1);
        setCurrentPage(1);
        return;
      }
      setLoading(true);
      setError(null);
      setCurrentPage(p);

      const unsub = wsClient.subscribe((res) => {
        if (res.type === "error") {
          setError(res.message || "Unknown error");
          setLoading(false);
          return unsub();
        }
        if (res.type === "favorites-reply") {
          setBooks(res.books || []);
          setTotalPages(res.totalPages ?? 1);
          setCurrentPage(res.currentPage ?? p);
          setLoading(false);
          unsub();
        }
      });

      wsClient.send({
        type: "get-favorites",
        ids: favIds,
        page: p,
        perPage: PER_PAGE,
        sort: s === "popular" ? "popular" : "relevance",
      });
    },
    [favIds, sortState]
  );

  useEffect(() => {
    fetchData(1, initialSort);
  }, [initialSort, fetchData]);

  useEffect(() => {
    fetchData(currentPage, sortState);
  }, [sortState]);

  const onSortChange = (sort: string) => {
    localStorage.setItem(FAVORITES_SORT_KEY, sort);
    setSortState(sort as SortType);
    fetchData(currentPage, sort as SortType);
  };

  const onPageChange = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
    fetchData(p, sortState);
  };

  const toggleFavorite = (id: number, add: boolean) => {
    setFavIds((prev) => {
      const next = add ? [...prev, id] : prev.filter((i) => i !== id);
      localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(next));
      if (!add) setBooks((b) => b.filter((book) => book.id !== id));
      return next;
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainContent}>
        {(error ||
          (!loading &&
            (favIds.length === 0 ||
              (favIds.length > 0 && books.length === 0)))) && (
          <StateBlock
            icon={error ? "⚠️" : favIds.length === 0 ? "📚" : "🔍"}
            title={
              error
                ? "Error"
                : favIds.length === 0
                ? "Your favorites are empty"
                : "Nothing found"
            }
            description={
              error ||
              (favIds.length === 0
                ? "Save the works you like, and they will appear here"
                : "Try changing the sort or filters")
            }
            retry={error ? () => fetchData(currentPage, sortState) : undefined}
          />
        )}
        {loading && <Loading />}
        {!loading && books.length > 0 && (
          <>
            <div className={styles.booksGrid}>
              {books.map((b) => (
                <BookCard
                  key={b.id}
                  book={b}
                  isFavorite={favIds.includes(b.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className={styles.paginationContainer}>
                <Pagination
                  totalPages={totalPages}
                  onPageChange={onPageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
      <MinimalHeader
        sortOptions={SORT_OPTS}
        defaultSort="relevance"
        onSortChange={onSortChange}
        onRefresh={() => fetchData(currentPage, sortState)}
        loading={loading}
        disabled={favIds.length === 0}
      />
    </div>
  );
};

export default SearchResultsFavorites;
