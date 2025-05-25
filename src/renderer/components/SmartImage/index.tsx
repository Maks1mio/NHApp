import React, { useState, useEffect } from "react";
import * as styles from "./SmartImage.module.scss";

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  blur?: boolean | number;
  fallbackUrls?: string[];
  loading?: "eager" | "lazy";
  showLoader?: boolean; // Новый проп для управления видимостью лоадера
}

const getFallbackImageUrls = (url: string): string[] => {
  const base = url.replace(/\.(webp|jpg|jpeg|png|gif|w)$/i, "");
  return [
    `${base}.webp`,
    `${base}.jpg.webp`,
    `${base}.jpg`,
    `${base}.png.webp`,
    `${base}.jpeg.webp`,
    `${base}.png`,
    `${base}.jpeg`,
    `${base}.gif`,
  ];
};

const SmartImage: React.FC<SmartImageProps> = ({ 
  src, 
  alt, 
  className, 
  blur = false,
  fallbackUrls,
  loading = "lazy",
  showLoader = true
}) => {
  const [fallbacks] = useState(() => fallbackUrls || getFallbackImageUrls(src));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(fallbacks[0]);

  useEffect(() => {
    setCurrentSrc(fallbacks[currentIndex]);
    setIsLoaded(false);
  }, [currentIndex, fallbacks]);

  const handleError = () => {
    if (currentIndex < fallbacks.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const blurStyle = typeof blur === 'number' 
    ? `blur(${blur}px)`
    : blur 
      ? 'blur(8px)' 
      : 'none';

  return (
    <div className={`${styles.imageWrapper} ${className}`}>
      <img
        src={currentSrc}
        alt={alt}
        onError={handleError}
        onLoad={handleLoad}
        loading={loading}
        className={styles.image}
        style={{
          filter: !isLoaded ? blurStyle : 'none',
          transition: 'filter 0.5s ease-out'
        }}
      />
      {!isLoaded && showLoader && (
        <div className={styles.loaderContainer}>
          <div className={styles.spinner} />
        </div>
      )}
    </div>
  );
};

export default SmartImage;