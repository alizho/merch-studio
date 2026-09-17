#!/usr/bin/env node

import { WebSocketServer } from "ws";

const PORT = Number(process.env.MULTIPLAYER_PORT ?? 4001);
const HEARTBEAT_INTERVAL_MS = 15_000;

const CURSOR_COLORS = [
  "#f97066",
  "#f79009",
  "#fac515",
  "#7cd992",
  "#36bffa",
  "#7a5af8",
  "#ee46bc",
];

const clients = new Map();
let nextColorIndex = 0;

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function nextColor() {
  const color = CURSOR_COLORS[nextColorIndex % CURSOR_COLORS.length];
  nextColorIndex += 1;
  return color;
}

function send(socket, message) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function broadcast(message, exceptId) {
  const payload = JSON.stringify(message);

  for (const [id, client] of clients) {
    if (id === exceptId) {
      continue;
    }

    if (client.socket.readyState === client.socket.OPEN) {
      client.socket.send(payload);
    }
  }
}

const server = new WebSocketServer({ port: PORT });

server.on("connection", (socket) => {
  const id = randomId();
  const color = nextColor();

  clients.set(id, { socket, color, isAlive: true });

  send(socket, { type: "welcome", id, color });
  broadcast({ type: "join", id, color }, id);

  socket.on("pong", () => {
    const client = clients.get(id);
    if (client) {
      client.isAlive = true;
    }
  });

  socket.on("message", (raw) => {
    let message;

    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (message?.type === "cursor" && typeof message.x === "number" && typeof message.y === "number") {
      broadcast({ type: "cursor", id, x: message.x, y: message.y }, id);
      return;
    }

    if (message?.type === "doc" && Array.isArray(message.layers) && message.components && typeof message.components === "object") {
      broadcast({ type: "doc", layers: message.layers, components: message.components }, id);
    }
  });

  socket.on("close", () => {
    clients.delete(id);
    broadcast({ type: "leave", id });
  });

  socket.on("error", () => {
    socket.terminate();
  });
});

const heartbeat = setInterval(() => {
  for (const [id, client] of clients) {
    if (!client.isAlive) {
      client.socket.terminate();
      clients.delete(id);
      broadcast({ type: "leave", id });
      continue;
    }

    client.isAlive = false;
    client.socket.ping();
  }
}, HEARTBEAT_INTERVAL_MS);

server.on("close", () => {
  clearInterval(heartbeat);
});

server.on("listening", () => {
  console.log(`[multiplayer] WebSocket server listening on ws://localhost:${PORT}`);
});
