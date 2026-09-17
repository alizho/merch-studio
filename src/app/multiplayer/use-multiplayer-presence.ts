import { useEffect, useRef, useState } from "react";

import { multiplayerSocket, type MultiplayerMessage } from "./socket";

export type RemoteCursor = {
  id: string;
  color: string;
  x: number;
  y: number;
};

const SEND_THROTTLE_MS = 50;

export function useMultiplayerPresence(): RemoteCursor[] {
  const [cursors, setCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const lastSentAt = useRef(0);

  useEffect(() => {
    const handleMessage = (message: MultiplayerMessage) => {
      setCursors((current) => {
        const next = new Map(current);

        if (message.type === "join") {
          next.set(message.id, { id: message.id, color: message.color, x: 0.5, y: 0.5 });
        } else if (message.type === "leave") {
          next.delete(message.id);
        } else if (message.type === "cursor") {
          const existing = next.get(message.id);
          next.set(message.id, {
            id: message.id,
            color: existing?.color ?? "#7a5af8",
            x: message.x,
            y: message.y,
          });
        }

        return next;
      });
    };

    const unsubscribe = multiplayerSocket.subscribe(handleMessage);

    const handlePointerMove = (event: PointerEvent) => {
      const now = performance.now();

      if (now - lastSentAt.current < SEND_THROTTLE_MS) {
        return;
      }

      lastSentAt.current = now;
      multiplayerSocket.send({
        type: "cursor",
        x: event.clientX / window.innerWidth,
        y: event.clientY / window.innerHeight,
      });
    };

    window.addEventListener("pointermove", handlePointerMove);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      unsubscribe();
    };
  }, []);

  return Array.from(cursors.values());
}
