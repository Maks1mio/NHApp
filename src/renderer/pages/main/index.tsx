import React from "react";
import { Outlet } from "react-router-dom";
import Header from "../../components/layout/header";
import Scrollbar from "../../components/ui/Scrollbar";
import * as styles from "./main.module.scss";

const MainPage: React.FC = () => {
  return (
    <div className={styles.container}>
      <Header />
      <Scrollbar className={styles.containerFix} classNameInner={styles.grid}>
        <Outlet />
      </Scrollbar>
    </div>
  );
};

export default MainPage;