import React, { useEffect, useState } from "react";
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

type ContentType = "favorites" | "new" | "search" | "popular";

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { favorites } = useFavorites();
  const { selectedTags } = useTagFilter();
  const PER_PAGE = 25;

  const handleSearch = (query: string, contentType: ContentType) => {
    let sortParam = "";

    if (contentType === "new") {
      sortParam = "date";
    }

    if (contentType === "popular") {
      const urlSort = new URLSearchParams(window.location.search).get("sort");
      const savedSort = localStorage.getItem("popularBooksSortType");
      sortParam =
        urlSort && urlSort !== ""
          ? urlSort
          : savedSort && savedSort !== ""
          ? (savedSort as string)
          : "popular";
    }

    if (contentType === "search") {
      const urlSort = new URLSearchParams(window.location.search).get("sort");
      const savedSort = localStorage.getItem("searchResultsSortType");
      sortParam =
        urlSort && urlSort !== ""
          ? urlSort
          : savedSort && savedSort !== ""
          ? (savedSort as string)
          : "popular";
    }

    wsClient.send({
      type: "search-books",
      query: contentType === "search" ? query : "",
      contentType,
      page: 1,
      perPage: PER_PAGE,
      filterTags: contentType !== "favorites" ? selectedTags : "",
      ids: contentType === "favorites" ? favorites : "",
      sort: sortParam,
    });
  };

  const [updateStatus, setUpdateStatus] = useState({
    status: "idle",
    message: "Check for Updates",
    version: "",
    percent: 0,
  });

  useEffect(() => {
    const handleUpdateStatus = (_event: any, status: any) => {
      setUpdateStatus((prev) => ({ ...prev, ...status }));
    };

    window.electron?.window?.onUpdateStatus?.(handleUpdateStatus);
    window.electron?.window?.checkForUpdates?.();

    return () => {
      window.electron?.window?.removeUpdateListeners?.();
    };
  }, []);

  const handleUpdateAction = () => {
    switch (updateStatus.status) {
      case "available":
        window.electron?.window?.downloadUpdate?.();
        break;
      case "downloaded":
        window.electron?.window?.installUpdate?.();
        break;
      default:
        window.electron?.window?.checkForUpdates?.();
    }
  };

  const getButtonText = () => {
    switch (updateStatus.status) {
      case "checking":
        return "Checking...";
      case "available":
        return `Download ${updateStatus.version}`;
      case "downloaded":
        return `Install ${updateStatus.version}`;
      case "downloading":
        return `Downloading ${updateStatus.percent.toFixed(0)}%`;
      default:
        return updateStatus.message;
    }
  };

  const getButtonClass = () => {
    let className = styles.updateButton;
    if (
      updateStatus.status === "checking" ||
      updateStatus.status === "downloading"
    ) {
      className += ` ${styles.loading}`;
    }
    if (updateStatus.status === "downloaded") {
      className += ` ${styles.install}`;
    }
    return className;
  };

  return (
    <header className={styles.nav}>
      <div className={styles.leftSide}>
        <img src={AppIcon} alt="NHentaiApp" className={styles.appIcon} />
        {(updateStatus.status === "available" ||
          updateStatus.status === "downloaded" ||
          updateStatus.status === "downloading" ||
          updateStatus.status === "checking") && (
          <button
            className={getButtonClass()}
            onClick={handleUpdateAction}
            disabled={
              updateStatus.status === "checking" ||
              updateStatus.status === "downloading"
            }
          >
            {getButtonText()}
            {updateStatus.status === "downloading" && (
              <div
                className={styles.progressBar}
                style={{ width: `${updateStatus.percent}%` }}
              />
            )}
          </button>
        )}
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
