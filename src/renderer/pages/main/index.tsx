import Header from "../../components/layout/header";
import * as styles from "./main.module.scss";

import ImportIcon from "../../../../static/assets/mainIcon/rectron.png";

function MainPage() {
  return (
    <div className={styles.container}>
      <Header title="Rectron" />
      <div className={styles.content}>
        <img src={ImportIcon} alt="Electron + React" className={styles.image} />
      </div>
    </div>
  );
}

export default MainPage;