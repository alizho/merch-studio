import { useEffect } from "react";
import { motion, useSpring } from "motion/react";

import styles from "./cursors-overlay.module.css";

const CURSOR_SPRING = { stiffness: 700, damping: 45, mass: 1 };

type RemoteCursorProps = {
  color: string;
  targetX: number;
  targetY: number;
};

export function RemoteCursor({ color, targetX, targetY }: RemoteCursorProps) {
  const x = useSpring(targetX, CURSOR_SPRING);
  const y = useSpring(targetY, CURSOR_SPRING);

  useEffect(() => {
    x.set(targetX);
  }, [targetX, x]);

  useEffect(() => {
    y.set(targetY);
  }, [targetY, y]);

  return (
    <motion.div className={styles.cursor} style={{ x, y }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M2 2L17 8.5L10.5 10.5L8.5 17L2 2Z"
          fill={color}
          stroke="white"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}
