import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BookCard, { Book } from "../BookCard";
import Pagination from "../Pagination";
import { FiCompass, FiTrendingUp } from "react-icons/fi";
import * as styles from "./SearchResults.module.scss";
import { wsClient } from "../../../wsClient";
import { useTagFilter } from "../../../context/TagFilterContext";
import MinimalHeader from "./MinimalHeader";
import { Loading, StateBlock } from "./SearchResultStates";

const PER_PAGE = 25;
const SEARCH_SORT_STORAGE_KEY = "searchResultsSortType";
const LS_FAVORITES_KEY = "bookFavorites";

type SortType = "newest" | "popular";

const SORT_OPTIONS: {
  value: SortType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "newest", label: "Newest First", icon: <FiCompass /> },
  { value: "popular", label: "Popular", icon: <FiTrendingUp /> },
];

const SearchResultsSearch: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const qp = new URLSearchParams(location.search);

  const searchQuery = qp.get("q") || "";
  const sortFromURL = qp.get("sort") as SortType | null;
  const pageFromURL = parseInt(qp.get("page") || "1", 10);
  const yearFromURL = qp.get("year") ? parseInt(qp.get("year"), 10) : null;
  const typeFromURL = qp.get("type") || "search";

  const { selectedTags } = useTagFilter();

  const [favIds, setFavIds] = useState<number[]>(() =>
    JSON.parse(localStorage.getItem(LS_FAVORITES_KEY) ?? "[]")
  );
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(pageFromURL);
  const [totalPages, setTotalPages] = useState(1);
  const lastRequestId = useRef<number>(0);

  const fetchData = useCallback(
    (
      page = 1,
      sort: SortType = (sortFromURL as SortType) || "newest",
      year: number | null = yearFromURL
    ) => {
      setLoading(true);
      setError(null);
      setCurrentPage(page);

      const requestId = Date.now();
      lastRequestId.current = requestId;

      const unsub = wsClient.subscribe((res) => {
        if (lastRequestId.current !== requestId) return;

        if (res.type === "error") {
          setError(res.message || "Unknown error");
          setLoading(false);
          return unsub();
        }
        if (res.type === "search-results-reply") {
          setBooks(res.books || []);
          setTotalPages(res.totalPages || 1);
          setCurrentPage(res.page || page);
          setLoading(false);
          unsub();
        }
      });

      wsClient.send({
        type: "search-books",
        query: searchQuery,
        sort: sort === "popular" ? "popular" : "date-desc",
        page,
        perPage: PER_PAGE,
        filterTags: selectedTags,
        contentType: typeFromURL as any,
        year: year,
      });
    },
    [searchQuery, selectedTags, sortFromURL, yearFromURL, typeFromURL]
  );

  useEffect(() => {
    fetchData(pageFromURL, (sortFromURL as SortType) || "newest", yearFromURL);
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
      const effectiveSort = newSort || (sortFromURL as SortType) || "newest";
      setCurrentPage(newPage);
      if (newSort && newSort !== sortFromURL) {
        localStorage.setItem(SEARCH_SORT_STORAGE_KEY, newSort);
      }
      fetchData(newPage, effectiveSort, newYear);
    }
  }, [qp]);

  const onSortChange = (sort: string) => {
    localStorage.setItem(SEARCH_SORT_STORAGE_KEY, sort);
    navigate(
      `/search?type=search&q=${encodeURIComponent(
        searchQuery
      )}&sort=${sort}&page=1`
    );
    fetchData(1, sort as SortType, yearFromURL);
  };

  const onPageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    navigate(
      `/search?type=search&q=${encodeURIComponent(searchQuery)}&sort=${
        sortFromURL || "newest"
      }${yearFromURL ? `&year=${yearFromURL}` : ""}&page=${page}`
    );
    fetchData(page, (sortFromURL as SortType) || "newest", yearFromURL);
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
            icon={error ? "⚠️" : "🔍"}
            title={error ? "Error" : "Nothing found"}
            description={error || "Try changing your search parameters or filters"}
            retry={error ? () => fetchData(currentPage, (sortFromURL as SortType) || "newest", yearFromURL) : undefined}
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
        sortOptions={SORT_OPTIONS}
        defaultSort="newest"
        onSortChange={onSortChange}
        onRefresh={() =>
          fetchData(
            currentPage,
            (sortFromURL as SortType) || "newest",
            yearFromURL
          )
        }
        loading={loading}
      />
    </div>
  );
};

export default SearchResultsSearch;