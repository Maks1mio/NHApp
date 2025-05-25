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

const Header: React.FC = () => {
  const navigate = useNavigate();

  const handleSearch = (query: string) => {
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleTagSelect = (tags: string[]) => {
    navigate(`/?tags=${encodeURIComponent(tags.join(","))}`);
  };

  const navigateToFavorites = () => {
    navigate("/favorites");
  };

  const navigateToNew = () => {
    navigate("/new");
  };

  const navigateToHome = () => {
    navigate("/");
  };

  return (
    <header className={styles.nav}>
      <div className={styles.leftSide}>
        <img
          src={AppIcon}
          alt="NHentaiApp"
          className={styles.appIcon}
          onClick={navigateToHome}
        />
        <div className={styles.favButtons}>
          <button
            className={styles.favButton}
            onClick={navigateToHome}
            aria-label="Главная страница"
          >
            <FiHome />
          </button>
          <button
            className={styles.favButton}
            onClick={navigateToNew}
            aria-label="Новое"
          >
            <FiClock />
          </button>
          <button
            className={styles.favButton}
            onClick={navigateToFavorites}
            aria-label="Избранное"
          >
            <FiHeart />
          </button>
        </div>
      </div>
      <div className={styles.rightSide}>
        {/* <TagFilter onTagSelect={handleTagSelect} /> */}
        <SearchInput
          onSearch={handleSearch}
          className={styles.searchInputWrapper}
        />
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
