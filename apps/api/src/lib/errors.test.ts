import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { NotFoundError } from '@social-autopilot/core';
import { handleError, type HonoEnv } from './errors.js';
import { createContentSchema, updateContentSchema } from '../routes/content.js';
import type { Context } from 'hono';

function fakeContext(environment = 'production') {
  return {
    env: { ENVIRONMENT: environment },
    json(body: unknown, status?: number) {
      return new Response(JSON.stringify(body), {
        status: status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
    get() {
      return 'req-1';
    },
  } as unknown as Context<HonoEnv>;
}

describe('content request validation', () => {
  it('rejects empty title', () => {
    expect(() => createContentSchema.parse({ title: '', body: 'script' })).toThrow(ZodError);
  });

  it('rejects arbitrary status mutation on update', () => {
    expect(() =>
      updateContentSchema.parse({ title: 'Hook', status: 'published' }),
    ).toThrow(ZodError);
  });
});

describe('handleError', () => {
  it('maps ZodError to HTTP 400', async () => {
    const error = (() => {
      try {
        createContentSchema.parse({ title: '' });
      } catch (e) {
        return e;
      }
    })();
    const response = handleError(fakeContext(), error);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('maps missing resources to HTTP 404', async () => {
    const response = handleError(fakeContext(), new NotFoundError('Content', 'missing'));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
