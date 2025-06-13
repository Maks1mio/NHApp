import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import BookCard, { Book } from "../BookCard";
import Pagination from "../Pagination";
import { FiClock, FiTrendingUp } from "react-icons/fi";
import { FaRedo } from "react-icons/fa";
import * as styles from "./SearchResults.module.scss";
import { wsClient } from "../../../wsClient";
import { useTagFilter } from "../../../context/TagFilterContext";
import MinimalHeader from "./MinimalHeader";
import { Loading, StateBlock } from "./SearchResultStates";

const PER_PAGE = 25;
const POPULAR_SORT_STORAGE_KEY = "popularBooksSortType";
const LS_FAVORITES_KEY = "bookFavorites";

type SortType = "popular" | "popular-week" | "popular-today" | "popular-month";

const SORT_OPTS: { value: SortType; label: string; icon: React.ReactNode }[] = [
  { value: "popular", label: "Popular (all time)", icon: <FiTrendingUp /> },
  { value: "popular-week", label: "Popular (week)", icon: <FiClock /> },
  { value: "popular-today", label: "Popular (today)", icon: <FiClock /> },
  { value: "popular-month", label: "Popular (month)", icon: <FiClock /> },
];

const SearchResultsPopular: React.FC = () => {
  const { search } = useLocation();
  const navigate = useNavigate();
  const qp = new URLSearchParams(search);
  const sortFromURL = qp.get("sort") as SortType | null;
  const pageFromURL = parseInt(qp.get("page") || "1", 10);
  const yearFromURL = qp.get("year") ? parseInt(qp.get("year"), 10) : null;

  const { selectedTags } = useTagFilter();

  const [favIds, setFavIds] = useState<number[]>(() =>
    JSON.parse(localStorage.getItem(LS_FAVORITES_KEY) ?? "[]")
  );
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoad] = useState(false);
  const [error, setErr] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(pageFromURL);
  const [totalPages, setTotalPages] = useState(1);

  const fetchData = useCallback(
    (
      page = 1,
      sort: SortType = (sortFromURL as SortType) || "popular",
      year: number | null = yearFromURL
    ) => {
      setLoad(true);
      setErr(null);
      setCurrentPage(page);

      const unsub = wsClient.subscribe((res) => {
        if (res.type === "error") {
          setErr(res.message || "Unknown error");
          setLoad(false);
          return unsub();
        }
        if (res.type === "popular-books-reply") {
          setBooks(res.books || []);
          setTotalPages(res.totalPages ?? 1);
          setCurrentPage(res.currentPage ?? page);
          setLoad(false);
          unsub();
        }
      });

      wsClient.send({
        type: "search-books",
        query: "",
        sort: sort,
        page,
        perPage: PER_PAGE,
        filterTags: selectedTags,
        contentType: "popular",
        year: year,
      });
    },
    [selectedTags, sortFromURL, yearFromURL]
  );

  useEffect(() => {
    fetchData(pageFromURL, (sortFromURL as SortType) || "popular", yearFromURL);
  }, [pageFromURL, sortFromURL, yearFromURL, fetchData]);

  useEffect(() => {
    const newPage = parseInt(qp.get("page") || "1", 10);
    const newSort = qp.get("sort") as SortType | null;
    const newYear = qp.get("year") ? parseInt(qp.get("year"), 10) : null;
    if (
      newPage !== currentPage ||
      (newSort && newSort !== sortFromURL) ||
      newYear !== yearFromURL
    ) {
      const effectiveSort = newSort || (sortFromURL as SortType) || "popular";
      setCurrentPage(newPage);
      if (newSort && newSort !== sortFromURL) {
        localStorage.setItem(POPULAR_SORT_STORAGE_KEY, newSort);
      }
      fetchData(newPage, effectiveSort, newYear);
    }
  }, [qp]);

  const onSortChange = (sort: string) => {
    localStorage.setItem(POPULAR_SORT_STORAGE_KEY, sort);
    navigate(`/search?type=popular&sort=${sort}&page=1`);
    fetchData(1, sort as SortType, yearFromURL);
  };

  const onPageChange = (p: number) => {
    if (p < 1 || p > totalPages) return;
    navigate(
      `/search?type=popular&sort=${sortFromURL || "popular"}${
        yearFromURL ? `&year=${yearFromURL}` : ""
      }&page=${p}`
    );
    fetchData(p, (sortFromURL as SortType) || "popular", yearFromURL);
  };

  const toggleFavorite = (id: number, add: boolean) => {
    setFavIds((prev) => {
      const next = add ? [...prev, id] : prev.filter((i) => i !== id);
      localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.mainContent}>
        {(error || (!loading && books.length === 0)) && (
          <StateBlock
            icon={error ? "⚠️" : "📈"}
            title={error ? "Error" : "Empty for now"}
            description={error || "No popular works found — try again later"}
            retry={
              error
                ? () =>
                    fetchData(
                      currentPage,
                      (sortFromURL as SortType) || "popular",
                      yearFromURL
                    )
                : undefined
            }
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
        defaultSort="popular"
        onSortChange={onSortChange}
        onRefresh={() =>
          fetchData(
            currentPage,
            (sortFromURL as SortType) || "popular",
            yearFromURL
          )
        }
        loading={loading}
      />
    </div>
  );
};

export default SearchResultsPopular;
