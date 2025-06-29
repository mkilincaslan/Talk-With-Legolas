import { z } from 'zod';
import { router, protectedProcedure } from '../index';
import { NotFoundError } from '../../utils/error';

// Router for thread-related procedures
export const threadRouter = router({
  // Get threads procedure
  getThreads: protectedProcedure.query(async ({ ctx }) => {
    const threads = await ctx.prisma.thread.findMany({
      where: {
        participants: {
          some: {
            id: ctx.auth.userId,
          },
        },
      },
      include: {
        participants: {
          select: {
            id: true,
            username: true,
            online: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Map threads to include lastMessage
    return threads.map(thread => ({
      ...thread,
      lastMessage: thread.messages[0] || null,
      messages: undefined, // Remove messages array since we're using lastMessage
    }));
  }),

  // Create thread procedure
  createThread: protectedProcedure
    .input(
      z.object({
        userName: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user exists
      const user = await ctx.prisma.user.findUnique({
        where: { username: input.userName },
        select: {
          id: true,
          username: true,
          online: true,
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if thread already exists between these users
      const existingThread = await ctx.prisma.thread.findFirst({
        where: {
          AND: [
            {
              participants: {
                some: {
                  id: ctx.auth.userId,
                },
              },
            },
            {
              participants: {
                some: {
                  id: user.id,
                },
              },
            },
          ],
        },
        include: {
          participants: {
            select: {
              id: true,
              username: true,
              online: true,
            },
          },
        },
      });

      if (existingThread) {
        return existingThread;
      }

      // Create new thread
      const thread = await ctx.prisma.thread.create({
        data: {
          participants: {
            connect: [{ id: ctx.auth.userId }, { id: user.id }],
          },
        },
        include: {
          participants: {
            select: {
              id: true,
              username: true,
              online: true,
            },
          },
        },
      });

      // Broadcast new thread to all participants
      ctx.wsEvents?.broadcastToThread(thread.id, {
        type: 'new_thread',
        thread,
      });

      return thread;
    }),
});
