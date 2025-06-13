import React, { useEffect, useState } from "react";
import * as styles from "./Pagination.module.scss";

interface PaginationProps {
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  totalPages,
  onPageChange,
  className = "",
}) => {
  if (totalPages <= 1) return null;

  const [currentPage, setCurrentPage] = useState(() => {
    const params = new URLSearchParams(window.location.href.split("?")[1]);
    return parseInt(params.get("page") || "1", 10);
  });

  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.href.split("?")[1]);
      const page = parseInt(params.get("page") || "1", 10);
      if (page !== currentPage && page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    };

    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("hashchange", handleUrlChange);

    // Initial check
    handleUrlChange();

    return () => {
      window.removeEventListener("popstate", handleUrlChange);
      window.removeEventListener("hashchange", handleUrlChange);
    };
  }, [totalPages, currentPage]);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    if (start > 1) {
      pages.push(1);
      if (start > 2) {
        pages.push("...");
      }
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        pages.push("...");
      }
      pages.push(totalPages);
    }

    return pages;
  };

  const handlePageChangeInternal = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      setCurrentPage(page);
      onPageChange(page);
    }
  };

  return (
    <div className={`${styles.pagination} ${className}`}>
      {getPageNumbers().map((page, index) =>
        page === "..." ? (
          <span key={`ellipsis-${index}`} className={styles.ellipsis}>
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => handlePageChangeInternal(page as number)}
            className={`${styles.page} ${
              currentPage === page ? styles.active : ""
            }`}
          >
            {page}
          </button>
        )
      )}
    </div>
  );
};

export default Pagination;
