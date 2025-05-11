import React from "react";
import * as styles from "./header.module.scss";
import { HeaderProps } from "../../types";


import MinusIcon from "./../../../../static/assets/icons/minus.svg";
import MinimizeIcon from "./../../../../static/assets/icons/minimize.svg";
import CloseIcon from "./../../../../static/assets/icons/close.svg";


const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <header className={styles.nav}>
      <div className={styles.leftSide}>
        <div className={styles.info}>
          {title}
        </div>
      </div>
      <div className={styles.rightSide}>
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
