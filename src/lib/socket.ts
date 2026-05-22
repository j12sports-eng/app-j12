import { io } from "socket.io-client";

import { getApiBaseUrl } from "@/lib/api";

function getSocketBaseUrl() {
  return getApiBaseUrl().replace(/\/api$/, "");
}

export const socket = io(getSocketBaseUrl(), {
  autoConnect: false,
  transports: ["websocket", "polling"],
  withCredentials: true,
});

export function ensureSocketConnected() {
  if (!socket.connected) {
    socket.connect();
  }
}

socket.on("nova_notificacao", (data) => {
  console.log("Nova notificacao realtime:", data);
});
