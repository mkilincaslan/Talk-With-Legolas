import { createWSClient } from "@trpc/client";
import type { WSMessage, MessageHandler } from "../types";

// Environment variables
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

class WSClientManager {
  private static instance: WSClientManager;
  private wsClient: ReturnType<typeof createWSClient> | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();

  private constructor() {}

  static getInstance(): WSClientManager {
    if (!WSClientManager.instance) {
      WSClientManager.instance = new WSClientManager();
    }
    return WSClientManager.instance;
  }

  connect(token: string) {
    if (this.wsClient) {
      return this.wsClient;
    }

    this.wsClient = createWSClient({
      url: `${WS_URL}?token=${token}`,
      onOpen: () => {
        console.log("WebSocket connection established");
      },
      onClose: () => {
        console.log("WebSocket connection closed");
        this.wsClient = null;
      },
      retryDelayMs: (retryCount) => {
        return Math.min(1000 * Math.pow(2, retryCount), 30000);
      },
    });

    // Get the raw WebSocket connection
    const ws = this.wsClient.getConnection();

    // Handle raw WebSocket messages
    ws.addEventListener("message", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as WSMessage;

        // Check if it's a tRPC message or a raw WebSocket message
        if (!data.method && data.type) {
          this.messageHandlers.forEach((handler) => handler(data));
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    return this.wsClient;
  }

  addMessageHandler(handler: MessageHandler) {
    this.messageHandlers.add(handler);
  }

  removeMessageHandler(handler: MessageHandler) {
    this.messageHandlers.delete(handler);
  }

  disconnect() {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
    this.messageHandlers.clear();
  }

  getClient() {
    return this.wsClient;
  }
}

export const wsClient = WSClientManager.getInstance();
