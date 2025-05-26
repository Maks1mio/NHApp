import React from "react";
import { useNavigate } from "react-router-dom";
import * as styles from "./header.module.scss";
import { FiHeart, FiClock, FiHome } from "react-icons/fi";
import SearchInput from "../SearchInput";
import TagFilter from "../TagFilter";

import MinusIcon from "./../../../../static/assets/icons/minus.svg";
import MinimizeIcon from "./../../../../static/assets/icons/minimize.svg";
import CloseIcon from "./../../../../static/assets/icons/close.svg";
import AppIcon from "./../../../../static/assets/icons/appicon.png";
import { useFavorites } from "../../../context/FavoritesContext";
import { wsClient } from "../../../wsClient";
import { useTagFilter } from "../../../context/TagFilterContext";

// Define ContentType if not imported from elsewhere
type ContentType = "favorites" | "new" | "search" | "popular";

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { favorites }   = useFavorites();
  const { selectedTags } = useTagFilter();
  const PER_PAGE = 25;

  const handleSearch = (query: string, contentType: ContentType) => {
    /* ── определяем sort, если нужен ───────────────────────────────────── */
    let sortParam = "";
    if (contentType === "new") {
      sortParam = "date";
    }
    if (contentType === "popular") {
      // 1) берём из URL, если там уже есть ?sort=...
      const urlSort = new URLSearchParams(window.location.search).get("sort");
      // 2) или из localStorage (то, что сохраняли в SearchResults)
      const savedSort = localStorage.getItem("popularBooksSortType");
      sortParam =
        urlSort && urlSort !== "" ? urlSort :
        savedSort && savedSort !== "" ? savedSort as string :
        "popular";                               // fallback
    }

    /* ── отправляем запрос ─────────────────────────────────────────────── */
    wsClient.send({
      type: "search-books",
      query: contentType === "search" ? query : "",
      contentType,
      page: 1,
      perPage: PER_PAGE,
      filterTags: contentType !== "favorites" ? selectedTags : "",
      ids:        contentType === "favorites" ? favorites     : "",
      sort:       sortParam,                     // <<<<< ключевая строка
    });
  };


  return (
    <header className={styles.nav}>
      <div className={styles.leftSide}>
        <img
          src={AppIcon}
          alt="NHentaiApp"
          className={styles.appIcon}
        />
      </div>
      <div className={styles.rightSide}>
        <SearchInput onSearch={handleSearch} />
        <div className={styles.buttonsContainer}>
          <div
            className={styles.buttons}
            onClick={() => window.electron?.window?.minimize?.()}
          >
            <MinusIcon />
          </div>
          <div
            className={styles.buttons}
            onClick={() => window.electron?.window?.maximize?.()}
          >
            <MinimizeIcon />
          </div>
          <div
            className={styles.buttons}
            onClick={() => window.electron?.window?.close?.()}
          >
            <CloseIcon />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
