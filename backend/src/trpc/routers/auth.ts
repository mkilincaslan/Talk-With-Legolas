import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../index';
import { verifyPassword } from '../../utils/crypto';
import { generateToken } from '../../utils/jwt';
import { AuthError } from '../../utils/error';

// Router for authentication-related procedures
export const authRouter = router({
  // Login procedure
  login: publicProcedure
    .input(
      z.object({
        username: z.string(),
        password: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find user by username
      const user = await ctx.prisma.user.findUnique({
        where: { username: input.username },
      });

      if (!user || !verifyPassword(input.password, user.password)) {
        throw new AuthError('Invalid username or password');
      }

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        username: user.username,
      });

      // Update user's online status to true
      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { online: true },
      });

      // Return token and user information
      return {
        token,
        user: {
          id: user.id,
          username: user.username,
        },
      };
    }),

  // Logout procedure
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    // Update user's online status to false
    await ctx.prisma.user.update({
      where: { id: ctx.auth.userId },
      data: { online: false },
    });

    return { success: true };
  }),
});
