import type { Context } from 'hono';
import { ZodError } from 'zod';
import { isAppError, type UserContext } from '@social-autopilot/core';
import type { AppContext } from './context.js';
import type { Env } from '../../worker-configuration.js';

export type HonoEnv = {
  Bindings: Env;
  Variables: {
    requestId: string;
    user: UserContext;
    services: AppContext;
  };
};

export function getServices(c: Context<HonoEnv>): AppContext {
  return c.get('services');
}

export function getUser(c: Context<HonoEnv>): UserContext {
  return c.get('user');
}

export function handleError(c: Context<HonoEnv>, error: unknown) {
  if (error instanceof ZodError) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          ...(c.env.ENVIRONMENT === 'development' ? { details: error.flatten() } : {}),
        },
      },
      400,
    );
  }

  if (isAppError(error)) {
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(c.env.ENVIRONMENT === 'development' && error.details
            ? { details: error.details }
            : {}),
        },
      },
      error.statusCode as 400 | 401 | 403 | 404 | 409 | 500 | 502,
    );
  }

  console.error(
    JSON.stringify({
      level: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      requestId: c.get('requestId'),
    }),
  );

  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    500,
  );
}
