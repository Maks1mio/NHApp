import React, { useState, useCallback } from "react";
import * as styles from "./SmartImage.module.scss";

interface SmartImageProps {
  src: string;                    // ← один URL
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}

const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  className,
  loading = "lazy",
}) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [fallbackStage, setFallbackStage] = useState(0);

  const handleError = useCallback(() => {
    // стадии замены:
    // 0 → пробуем .jpg.webp
    // 1 → пробуем .png.webp
    // 2 → больше нечего пробовать
    if (fallbackStage > 1) {
      return;
    }

    // разбиваем URL по точкам, чтобы заменить расширение
    const parts = currentSrc.split(".");
    // base: всё до первого расширения
    const base = parts.slice(0, -1).join(".");

    // выбираем нужную замену
    const nextExt =
      fallbackStage === 0
        ? "jpg.webp"
        : "png.webp";

    // строим новый src и переключаем стадию
    setCurrentSrc(`${base}.${nextExt}`);
    setFallbackStage((stage) => stage + 1);
  }, [currentSrc, fallbackStage]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading={loading}
      className={`${styles.image} ${className ?? ""}`}
      onError={handleError}
    />
  );
};

export default SmartImage;
