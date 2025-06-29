import { initTRPC } from '@trpc/server';
import { Context } from './context';
import { handleError } from '../utils/error';
import { AuthError } from '../utils/error';

export const t = initTRPC.context<Context>().create({
  errorFormatter: ({ error, shape }) => {
    const formattedError = handleError(error.cause);
    return {
      ...shape,
      data: {
        ...shape.data,
        code: formattedError.code,
        httpStatus: formattedError.statusCode,
      },
    };
  },
});

// Logging middleware
const loggerMiddleware = t.middleware(async ({ path, type, next, ctx }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;

  if (result.ok) {
    ctx.logger.info(`${type} ${path} completed`, {
      procedure: path,
      type,
      durationMs,
      userId: ctx.auth?.userId,
    });
  } else {
    ctx.logger.error(`${type} ${path} failed`, {
      procedure: path,
      type,
      durationMs,
      error: result.error,
      userId: ctx.auth?.userId,
    });
  }

  return result;
});

export const router = t.router;
export const publicProcedure = t.procedure.use(loggerMiddleware);

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.auth) {
    throw new AuthError('Not authenticated');
  }
  return next({
    ctx: {
      auth: ctx.auth,
    },
  });
});

export const protectedProcedure = t.procedure.use(loggerMiddleware).use(isAuthed);
