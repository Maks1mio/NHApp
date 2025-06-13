import React from "react";
import * as styles from "./SearchResults.module.scss";
import { LOADING_PHRASES } from "./LoadingPhrases";

interface LoaderProps {
  progress?: { message: string; percent: number } | null;
}

interface StateBlockProps {
  icon: string;
  title?: string;
  description: string;
  retry?: () => void;
}

export const Loading: React.FC<LoaderProps> = ({ progress }) => {
  const randomPhrase = LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)];

  return (
    <div className={styles.loadingState}>
      <div className={styles.loadingSpinner}>
        <div className={styles.spinnerRing}></div>
        <div className={styles.spinnerIcon}>{randomPhrase.emoji}</div>
      </div>
      {progress ? (
        <div className={styles.loadingInfo}>
          <strong className={styles.loadingMessage}>{progress.message}</strong>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      ) : (
        <div className={styles.loadingMessage}>
          {randomPhrase.text}
        </div>
      )}
    </div>
  );
};

export const StateBlock: React.FC<StateBlockProps> = ({ icon, title, description, retry }) => (
  <div className={styles.stateBlock}>
    <div className={styles.stateContent}>
      <div className={styles.stateIcon}>{icon}</div>
      {title && <h3 className={styles.stateTitle}>{title}</h3>}
      <p className={styles.stateDescription}>{description}</p>
      {retry && (
        <button className={styles.retryButton} onClick={retry}>
          Retry
        </button>
      )}
    </div>
  </div>
);

export const ErrorBlock: React.FC<{ msg: string; retry: () => void }> = ({ msg, retry }) => (
  <StateBlock icon="⚠️" title="Error" description={msg} retry={retry} />
);

export const EmptyPopular: React.FC = () => (
  <StateBlock
    icon="📈"
    title="Empty for now"
    description="No popular works found — try again later"
  />
);

export const EmptySearch: React.FC = () => (
  <StateBlock
    icon="🔍"
    title="Nothing found"
    description="Try changing your search parameters or filters"
  />
);

export const EmptyFavorites: React.FC = () => (
  <StateBlock
    icon="📚"
    title="Your favorites are empty"
    description="Save the works you like, and they will appear here"
  />
);

export const EmptyFavoritesResults: React.FC = () => (
  <StateBlock
    icon="🔍"
    title="Nothing found"
    description="Try changing the sort or filters"
  />
);

export const NoFavorites: React.FC = () => (
  <StateBlock icon="📚" description="No favorite books." />
);

export const NoRecommendations: React.FC = () => (
  <StateBlock icon="📚" description="No recommendations." />
);