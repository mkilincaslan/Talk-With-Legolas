import { inferAsyncReturnType } from '@trpc/server';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../utils/jwt';
import { createRequestLogger } from '../utils/logger';
import { WebSocket } from 'ws';
import { WebSocketEvents } from '../websocket/events';

// Interface defining the shape of context creation options
interface CreateContextOptions {
  req?: {
    headers: {
      authorization?: string;
    };
  };
  ws?: WebSocket; // WebSocket connection for real-time communication
  wsEvents?: WebSocketEvents; // WebSocket event handlers
  auth?: {
    // Pre-validated auth data
    userId: string;
    username: string;
  };
  prisma?: PrismaClient; // Database client instance
}

// Global WebSocket events instance shared across all connections
let globalWsEvents: WebSocketEvents | null = null;

// Setter for global WebSocket events instance, called during server initialization
export const setGlobalWsEvents = (wsEvents: WebSocketEvents) => {
  globalWsEvents = wsEvents;
};

// Creates context for each tRPC request/WebSocket connection
export const createContext = async ({ req, ws, wsEvents, prisma }: CreateContextOptions = {}) => {
  // Generate unique request ID for tracing
  const requestId = Math.random().toString(36).substring(7);
  const logger = createRequestLogger(requestId);

  // Reuse existing Prisma client or create new one
  const db = prisma || new PrismaClient();

  // Extract and validate JWT token from Authorization header
  let auth;
  const authHeader = req?.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      auth = verifyToken(token);
    } catch (error) {
      // Log warning but don't throw - let procedures handle auth requirements
      logger.warn('Invalid auth token');
    }
  }

  // Use provided WebSocket events or fallback to global instance
  const effectiveWsEvents = wsEvents || globalWsEvents;

  // Return context object used in all tRPC procedures
  return {
    prisma: db, // Database access
    logger, // Request-scoped logger
    auth, // Authentication data
    ws, // WebSocket connection
    wsEvents: effectiveWsEvents, // WebSocket event handlers
    req, // Original request object
  };
};

// Export type of context for use in procedures
export type Context = inferAsyncReturnType<typeof createContext>;
