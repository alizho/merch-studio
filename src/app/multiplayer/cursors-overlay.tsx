import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

import { RemoteCursor } from "./remote-cursor";
import { useMultiplayerDocumentSync } from "./use-multiplayer-document-sync";
import { useMultiplayerPresence } from "./use-multiplayer-presence";
import styles from "./cursors-overlay.module.css";

function useViewportSize() {
  const [size, setSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
}

export function MultiplayerCursorsOverlay() {
  const cursors = useMultiplayerPresence();
  const { width, height } = useViewportSize();
  useMultiplayerDocumentSync();

  return createPortal(
    <div className={styles.overlay}>
      {cursors.map((cursor) => (
        <RemoteCursor
          key={cursor.id}
          color={cursor.color}
          targetX={cursor.x * width}
          targetY={cursor.y * height}
        />
      ))}
    </div>,
    document.body,
  );
}
