import { Hono } from 'hono';
import {
  corsMiddleware,
  rateLimitMiddleware,
  requestIdMiddleware,
  servicesMiddleware,
  userContextMiddleware,
} from './middleware/index.js';
import { contentRoutes } from './routes/content.js';
import { scheduledPostRoutes } from './routes/scheduled-posts.js';
import { socialAccountRoutes } from './routes/social-accounts.js';
import type { HonoEnv } from './lib/errors.js';
import type { Env } from '../worker-configuration.js';

const app = new Hono<HonoEnv>();

app.use('*', corsMiddleware);
app.use('*', requestIdMiddleware);
app.use('*', userContextMiddleware);
app.use('*', rateLimitMiddleware);
app.use('/api/*', servicesMiddleware);

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  }),
);

app.route('/api/content', contentRoutes);
app.route('/api/scheduled-posts', scheduledPostRoutes);
app.route('/api/social-accounts', socialAccountRoutes);

app.notFound((c) =>
  c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404),
);

import { scheduled } from './handlers/scheduled.js';
import { queue } from './handlers/queue.js';

export default {
  fetch: app.fetch,
  scheduled,
  queue,
};

export type { Env };
