import React from "react";
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
}) => (
  <img
    src={src}
    alt={alt}
    loading={loading}
    className={`${styles.image} ${className ?? ""}`}
  />
);

export default SmartImage;
