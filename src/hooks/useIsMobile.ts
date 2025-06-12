// hooks/useIsMobile.ts
import { useEffect, useState } from "react";

export function useIsMobile(maxWidth = 900) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= maxWidth);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= maxWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [maxWidth]);

  return isMobile;
}
