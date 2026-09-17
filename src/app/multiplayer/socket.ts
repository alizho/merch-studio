import type { ToolcraftLayer } from "@/toolcraft/runtime";

import type { ComponentMap } from "../state/components";

export type MultiplayerDocState = {
  layers: readonly ToolcraftLayer[];
  components: ComponentMap;
};

export type MultiplayerMessage =
  | { type: "welcome"; id: string; color: string }
  | { type: "join"; id: string; color: string }
  | { type: "leave"; id: string }
  | { type: "cursor"; id: string; x: number; y: number }
  | ({ type: "doc" } & MultiplayerDocState);

export type MultiplayerOutgoingMessage =
  | { type: "cursor"; x: number; y: number }
  | ({ type: "doc" } & MultiplayerDocState);

type MessageHandler = (message: MultiplayerMessage) => void;

const RECONNECT_DELAY_MS = 2000;

function resolveMultiplayerUrl(): string {
  const configured = (import.meta as ImportMeta & { env?: Record<string, string> }).env
    ?.VITE_MULTIPLAYER_URL;

  return configured ?? "ws://localhost:4001";
}

class MultiplayerSocket {
  private socket: WebSocket | null = null;
  private handlers = new Set<MessageHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(): void {
    if (this.socket) {
      return;
    }

    const socket = new WebSocket(resolveMultiplayerUrl());
    this.socket = socket;

    socket.addEventListener("message", (event) => {
      let message: MultiplayerMessage;

      try {
        message = JSON.parse(event.data as string);
      } catch {
        return;
      }

      for (const handler of this.handlers) {
        handler(message);
      }
    });

    socket.addEventListener("close", () => {
      this.socket = null;
      this.scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      socket.close();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.handlers.size === 0) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    this.connect();

    return () => {
      this.handlers.delete(handler);
    };
  }

  send(message: MultiplayerOutgoingMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }
}

export const multiplayerSocket = new MultiplayerSocket();
