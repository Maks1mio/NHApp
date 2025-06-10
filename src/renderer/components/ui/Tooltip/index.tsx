import React, { ReactNode, useLayoutEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

interface Props {
  anchorEl?: HTMLElement | null;
  open?: boolean;
  children: ReactNode;
  title?: string;
}

const Tooltip: React.FC<Props> = ({ anchorEl, open, children, title }) => {
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const bubbleRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!anchorEl || !open) return;
    const rect = anchorEl.getBoundingClientRect();
    const bubble = bubbleRef.current;
    const gap = 8;
    if (bubble) {
      const { width } = bubble.getBoundingClientRect();
      setPos({
        top: rect.bottom + gap,
        left: rect.right - width,
      });
    }
  }, [anchorEl, open]);

  if (typeof document === "undefined") return null;
  return ReactDOM.createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={bubbleRef}
          className="nh-tooltip"
          style={{ top: pos.top, left: pos.left, pointerEvents: "auto" }}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16 }}
        >
          {title && <div className="nh-tooltip-title">{title}</div>}
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default Tooltip;