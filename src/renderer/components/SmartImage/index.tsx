import React, { useState, useCallback, CSSProperties, forwardRef } from "react";
import * as styles from "./SmartImage.module.scss";

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  style?: CSSProperties;
  innerRef?: React.Ref<HTMLImageElement>;
}

const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  className,
  loading = "lazy",
  style,
  innerRef,
}) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [fallbackStage, setFallbackStage] = useState(0);

  const handleError = useCallback(() => {
    if (fallbackStage > 1) {
      return;
    }
    const parts = currentSrc.split(".");
    const base = parts.slice(0, -1).join(".");
    const nextExt =
      fallbackStage === 0
        ? "jpg.webp"
        : "png.webp";
    setCurrentSrc(`${base}.${nextExt}`);
    setFallbackStage((stage) => stage + 1);
  }, [currentSrc, fallbackStage]);

  return (
    <img
      ref={innerRef}
      src={currentSrc}
      alt={alt}
      loading={loading}
      className={`${styles.image} ${className ?? ""}`}
      style={style}
      onError={handleError}
    />
  );
};

export default SmartImage;
