import { io, type Socket } from "socket.io-client";

import { getApiBaseUrl } from "./api";

type SocketHandler = (...args: any[]) => void;

function getSocketBaseUrl() {
  return getApiBaseUrl().replace(/\/api$/, "");
}

function isBrowser() {
  return typeof window !== "undefined";
}

let socketInstance: Socket | null = null;

function getSocket() {
  if (!isBrowser()) {
    return null;
  }

  if (!socketInstance) {
    socketInstance = io(getSocketBaseUrl(), {
      autoConnect: false,
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socketInstance.on("nova_notificacao", (data) => {
      console.log("Nova notificacao realtime:", data);
    });
  }

  return socketInstance;
}

export const socket = {
  get connected() {
    return getSocket()?.connected ?? false;
  },

  connect() {
    getSocket()?.connect();
    return socket;
  },

  disconnect() {
    getSocket()?.disconnect();
    return socket;
  },

  on(event: string, handler: SocketHandler) {
    getSocket()?.on(event, handler);
    return socket;
  },

  off(event: string, handler?: SocketHandler) {
    getSocket()?.off(event, handler);
    return socket;
  },
};

export function ensureSocketConnected() {
  if (!socket.connected) {
    socket.connect();
  }
}
