import { createMiddleware } from 'hono/factory';
import type { HonoEnv } from '../lib/errors.js';
import { createAppContext } from '../lib/context.js';

export const requestIdMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  await next();
});

export const servicesMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  c.set('services', createAppContext(c.env));
  await next();
});

export const corsMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-request-id');

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  await next();
});

/**
 * Basic rate limiting design: track requests per IP in memory.
 * For production, replace with Cloudflare Rate Limiting or Durable Objects.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 100;

export const rateLimitMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else if (entry.count >= RATE_LIMIT_MAX) {
    return c.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, 429);
  } else {
    entry.count++;
  }

  await next();
});
