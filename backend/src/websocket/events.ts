import { WebSocket } from 'ws';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';

// Interface defining the shape of WebSocket messages
interface WSMessage {
  // Message type: typing, message, or new_thread
  type: 'typing' | 'message' | 'new_thread';
  threadId: string;
  content?: string;
  isTyping?: boolean;
  thread?: {
    id: string;
    participants: {
      id: string;
      username: string;
      online: boolean;
    }[];
  };
}

// Class for managing WebSocket events
export class WebSocketEvents {
  // Map of connected clients by user ID
  private clients: Map<string, WebSocket> = new Map();
  // Map of typing users by thread ID
  private typingUsers: Map<string, Set<string>> = new Map();

  constructor(private prisma: PrismaClient) {}

  // Verify JWT token and return user ID
  verifyToken(token: string): string {
    const payload = verifyToken(token);
    return payload.userId;
  }

  // Handle WebSocket connection
  async handleConnection(ws: WebSocket, userId: string) {
    this.clients.set(userId, ws);

    // Update user's online status to true
    await this.prisma.user.update({
      where: { id: userId },
      data: { online: true },
    });

    // Get user's threads to broadcast online status to other users in shared threads
    const threads = await this.prisma.thread.findMany({
      where: {
        participants: {
          some: { id: userId },
        },
      },
      select: { id: true },
    });

    // Broadcast online status to other users in shared threads
    for (const thread of threads) {
      this.broadcastToThread(thread.id, {
        type: 'online_status',
        userId,
        isOnline: true,
      });
    }

    logger.info(`User ${userId} connected`);
  }

  // Handle WebSocket disconnection
  async handleDisconnect(ws: WebSocket) {
    const userId = this.findUserIdByWs(ws);
    if (!userId) return;

    // Get user's threads before removing the client to broadcast offline status to other users in shared threads
    const threads = await this.prisma.thread.findMany({
      where: {
        participants: {
          some: { id: userId },
        },
      },
      select: { id: true },
    });

    this.clients.delete(userId);

    // Update user's online status to false
    await this.prisma.user.update({
      where: { id: userId },
      data: { online: false },
    });

    // Broadcast offline status to other users in shared threads
    for (const thread of threads) {
      this.broadcastToThread(thread.id, {
        type: 'online_status',
        userId,
        isOnline: false,
      });
    }

    logger.info(`User ${userId} disconnected`);
  }

  // Handle WebSocket message
  async handleMessage(ws: WebSocket, data: Buffer | string) {
    const userId = this.findUserIdByWs(ws);
    if (!userId) return;

    try {
      const message = JSON.parse(data.toString()) as WSMessage;

      // Verify user has access to the thread
      const thread = await this.prisma.thread.findFirst({
        where: {
          id: message.threadId,
          participants: {
            some: { id: userId },
          },
        },
      });

      if (!thread) {
        logger.warn(`User ${userId} tried to access unauthorized thread ${message.threadId}`);
        return;
      }

      // Handle different message types
      switch (message.type) {
        case 'typing':
          this.handleTyping(userId, message.threadId, message.isTyping || false);
          break;

        case 'message':
          if (message.content) {
            await this.handleNewMessage(userId, message.threadId, message.content);
          }
          break;

        default:
          logger.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error: any) {
      logger.error('Error handling message:', error);
    }
  }

  // Find user ID by WebSocket connection
  private findUserIdByWs(ws: WebSocket): string | undefined {
    for (const [userId, client] of this.clients.entries()) {
      if (client === ws) return userId;
    }
    return undefined;
  }

  // Handle typing status
  private handleTyping(userId: string, threadId: string, isTyping: boolean) {
    if (!this.typingUsers.has(threadId)) {
      this.typingUsers.set(threadId, new Set());
    }

    const threadTypingUsers = this.typingUsers.get(threadId)!;
    if (isTyping) {
      threadTypingUsers.add(userId);
    } else {
      threadTypingUsers.delete(userId);
    }

    this.broadcastToThread(threadId, {
      type: 'typing_status',
      threadId,
      userId,
      isTyping,
    });
  }

  // Handle new message
  private async handleNewMessage(userId: string, threadId: string, content: string) {
    // Create message in database
    const message = await this.prisma.message.create({
      data: {
        content,
        threadId,
        senderId: userId,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // Update thread's last activity
    await this.prisma.thread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    // Broadcast message to all users in thread
    this.broadcastToThread(threadId, {
      type: 'new_message',
      threadId,
      message,
    });
  }

  // Broadcast message to all users in thread
  public async broadcastToThread(threadId: string, data: unknown) {
    // Get all participants of the thread
    const thread = await this.prisma.thread.findUnique({
      where: { id: threadId },
      include: {
        participants: {
          select: { id: true },
        },
      },
    });

    if (!thread) return;

    // Send message to all connected participants
    for (const participant of thread.participants) {
      const ws = this.clients.get(participant.id);
      if (ws) {
        ws.send(JSON.stringify(data));
      }
    }
  }
}
