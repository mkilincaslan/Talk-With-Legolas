import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { WebSocketServer } from 'ws';
import { router, publicProcedure } from './trpc';
import { createContext, setGlobalWsEvents } from './trpc/context';
import { authRouter } from './trpc/routers/auth';
import { threadRouter } from './trpc/routers/thread';
import { messageRouter } from './trpc/routers/message';
import { logger } from './utils/logger';
import { PrismaClient } from '@prisma/client';
import { seedDatabase } from './seed/users';
import cors from 'cors';
import { WebSocketEvents } from './websocket/events';
import { parse as parseUrl } from 'url';

// Define the main tRPC router
export const appRouter = router({
  health: publicProcedure.query(() => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })),
  auth: authRouter,
  thread: threadRouter,
  message: messageRouter,
});

export type AppRouter = typeof appRouter;

const port = Number(process.env.PORT || 3000);

// Start server
const startServer = async () => {
  try {
    // Create Prisma client and connect to database
    const prisma = new PrismaClient();
    await prisma.$connect();
    logger.info('Successfully connected to database');

    // Seed database with default users
    await seedDatabase();

    // Create HTTP server
    const { server, listen } = createHTTPServer({
      router: appRouter,
      createContext,
      middleware: cors(),
    });

    // Create WebSocket server
    const wss = new WebSocketServer({ server });

    // Initialize WebSocket events
    const wsEvents = new WebSocketEvents(prisma);
    setGlobalWsEvents(wsEvents);

    // Apply tRPC WebSocket handler
    const handler = applyWSSHandler({
      wss,
      router: appRouter,
      createContext: async opts => {
        const ctx = await createContext({
          ...opts,
          wsEvents,
          prisma,
        });
        return ctx;
      },
    });

    // Handle WebSocket connections
    wss.on('connection', async (ws, req) => {
      try {
        // Parse URL and get token from query
        const { query } = parseUrl(req.url || '', true);
        const token = query.token as string;

        if (!token) {
          ws.close(1008, 'Token required');
          return;
        }

        // Verify token and get userId
        const userId = wsEvents.verifyToken(token);
        if (!userId) {
          ws.close(1008, 'Invalid token');
          return;
        }

        // Handle the connection with the verified userId
        await wsEvents.handleConnection(ws, userId);

        // Handle disconnection
        ws.on('close', () => {
          wsEvents.handleDisconnect(ws);
          logger.info(`Client disconnected (${wss.clients.size} total)`);
        });

        // Handle messages
        ws.on('message', async data => {
          try {
            await wsEvents.handleMessage(ws, data.toString());
          } catch (error) {
            logger.error(`Error handling message: ${error}`);
          }
        });

        logger.info(`Client connected (${wss.clients.size} total)`);
      } catch (error) {
        logger.error(`Error in WebSocket connection: ${error}`);
        ws.close(1011, 'Internal server error');
      }
    });

    // Start server
    listen(port);
    logger.info(`HTTP Server is running on http://localhost:${port}`);
    logger.info(`WebSocket Server is running on ws://localhost:${port}`);

    // Cleanup on shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, closing server...');
      handler.broadcastReconnectNotification();
      wss.close();
      server.close();
      prisma.$disconnect();
    });
  } catch (error: any) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
