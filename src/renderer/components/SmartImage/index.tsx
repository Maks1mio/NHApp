import React, { useState, useEffect } from "react";
import * as styles from "./SmartImage.module.scss";

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  blur?: boolean | number;
  loading?: "eager" | "lazy";
  showLoader?: boolean;
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
  loading = "lazy",
  showLoader = true,
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>(src);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    // Формируем список URL для попыток
    const urls = [src, ...getFallbackImageUrls(src)];
    let cancelled = false;

    // создаём по одному Image для каждого URL
    const loaders = urls.map((url) => {
      return new Promise<string | null>((resolve) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(url);
        img.onerror = () => resolve(null);
      });
    });

    // ждём первой успешной загрузки
    Promise.all(loaders).then((results) => {
      if (cancelled) return;
      const good = results.find((u) => u);
      if (good) {
        setCurrentSrc(good);
        setIsLoaded(true);
      } else {
        // если ни одна не загрузилась — оставляем оригинал, но скрываем лоадер
        setCurrentSrc(src);
        setIsLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  const blurStyle =
    typeof blur === "number" ? `blur(${blur}px)` : blur ? "blur(8px)" : "none";

  return (
    <div className={`${styles.imageWrapper} ${className || ""}`}>
      {!isLoaded && showLoader && (
        <div className={styles.loaderContainer}>
          <div className={styles.spinner} />
        </div>
      )}
      <img
        src={currentSrc}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        loading={loading}
        className={styles.image}
        style={{
          filter: !isLoaded ? blurStyle : "none",
          transition: "filter 0.5s ease-out",
        }}
      />
    </div>
  );
};

export default SmartImage;
