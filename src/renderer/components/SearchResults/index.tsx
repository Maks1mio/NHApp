// index.tsx
import React from "react";
import { useLocation } from "react-router-dom";

import SearchResultsSearch from "./SearchResultsSearch";
import SearchResultsPopular from "./SearchResultsPopular";
import SearchResultsFavorites from "./SearchResultsFavorites";
import SearchResultsRecommendations from "./SearchResultsRecommendations";

type ContentType = "search" | "popular" | "favorites" | "recommendations";

const SearchResults: React.FC = () => {
  const { search } = useLocation();
  const qp = new URLSearchParams(search);
  const type = (qp.get("type") || "search") as ContentType;

  console.log("Current route type:", type, "Search:", search);

  switch (type) {
    case "popular":
      return <SearchResultsPopular />;
    case "favorites":
      return <SearchResultsFavorites />;
    case "recommendations":
      return <SearchResultsRecommendations />;
    case "search":
    default:
      return <SearchResultsSearch />;
  }
};

export default SearchResults;
