import { z } from 'zod';
import { router, protectedProcedure } from '../index';
import { NotFoundError } from '../../utils/error';

// Router for message-related procedures
export const messageRouter = router({
  // Get messages procedure
  getMessages: protectedProcedure
    .input(
      z.object({
        threadId: z.string(),
        page: z.number().int().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify thread exists and user has access to it
      const thread = await ctx.prisma.thread.findFirst({
        where: {
          id: input.threadId,
          participants: {
            some: {
              id: ctx.auth.userId,
            },
          },
        },
      });

      if (!thread) {
        throw new NotFoundError('Thread not found');
      }

      // Define page size and calculate skip value
      const pageSize = 20;
      const skip = (input.page - 1) * pageSize;

      // Get messages for the thread
      const messages = await ctx.prisma.message.findMany({
        where: {
          threadId: input.threadId,
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc', // Get newest messages first for proper pagination
        },
        skip,
        take: pageSize,
      });

      // Mark messages as read only for the first page
      if (input.page === 1) {
        await ctx.prisma.message.updateMany({
          where: {
            threadId: input.threadId,
            senderId: {
              not: ctx.auth.userId,
            },
            unread: true,
          },
          data: {
            unread: false,
          },
        });
      }

      // Return messages in chronological order (oldest first)
      return messages.reverse();
    }),

  // Send message procedure
  send: protectedProcedure
    .input(
      z.object({
        threadId: z.string(),
        content: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify thread exists and user has access to it
      const thread = await ctx.prisma.thread.findFirst({
        where: {
          id: input.threadId,
          participants: {
            some: {
              id: ctx.auth.userId,
            },
          },
        },
      });

      if (!thread) {
        throw new NotFoundError('Thread not found');
      }

      // Create message with the given content
      const message = await ctx.prisma.message.create({
        data: {
          content: input.content,
          threadId: input.threadId,
          senderId: ctx.auth.userId,
          unread: true,
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
      await ctx.prisma.thread.update({
        where: { id: input.threadId },
        data: { updatedAt: new Date() },
      });

      // Broadcast message to all users in thread
      ctx.wsEvents?.broadcastToThread(input.threadId, {
        type: 'new_message',
        threadId: input.threadId,
        message,
      });

      return message;
    }),

  // Typing status procedure
  typing: protectedProcedure
    .input(
      z.object({
        threadId: z.string(),
        isTyping: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify thread exists and user has access to it
      const thread = await ctx.prisma.thread.findFirst({
        where: {
          id: input.threadId,
          participants: {
            some: {
              id: ctx.auth.userId,
            },
          },
        },
      });

      if (!thread) {
        throw new NotFoundError('Thread not found');
      }

      // Broadcast typing status to all users in thread
      ctx.wsEvents?.broadcastToThread(input.threadId, {
        type: 'typing_status',
        threadId: input.threadId,
        userId: ctx.auth.userId,
        isTyping: input.isTyping,
      });

      return { success: true };
    }),

  // Mark as read procedure
  markAsRead: protectedProcedure
    .input(
      z.object({
        threadId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify thread exists and user has access to it
      const thread = await ctx.prisma.thread.findFirst({
        where: {
          id: input.threadId,
          participants: {
            some: {
              id: ctx.auth.userId,
            },
          },
        },
      });

      if (!thread) {
        throw new NotFoundError('Thread not found');
      }

      // Mark messages as read where sender is not the current user
      await ctx.prisma.message.updateMany({
        where: {
          threadId: input.threadId,
          senderId: {
            not: ctx.auth.userId,
          },
          unread: true,
        },
        data: {
          unread: false,
        },
      });

      return { success: true };
    }),
});
