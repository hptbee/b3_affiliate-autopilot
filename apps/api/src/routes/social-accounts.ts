import { z } from 'zod';
import { Hono } from 'hono';
import { connectFacebookPage, FacebookGraphClient } from '@social-autopilot/social';
import type { HonoEnv } from '../lib/errors.js';
import { getServices, getUser, handleError } from '../lib/errors.js';

const connectFacebookSchema = z
  .object({
    pageId: z.string().min(1),
    pageAccessToken: z.string().min(1),
    displayName: z.string().min(1).optional(),
  })
  .strict();

const publishContentSchema = z
  .object({
    socialAccountId: z.string().uuid(),
  })
  .strict();

export const socialAccountRoutes = new Hono<HonoEnv>();

socialAccountRoutes.get('/', async (c) => {
  try {
    const { socialAccountService } = getServices(c);
    const accounts = await socialAccountService.list(getUser(c));
    return c.json({
      data: accounts.map((account) => ({
        id: account.id,
        platform: account.platform,
        externalAccountId: account.externalAccountId,
        displayName: account.displayName,
        status: account.status,
        createdAt: account.createdAt,
      })),
    });
  } catch (error) {
    return handleError(c, error);
  }
});

socialAccountRoutes.post('/facebook/connect', async (c) => {
  try {
    const body = connectFacebookSchema.parse(await c.req.json());
    const { socialAccountService } = getServices(c);
    const user = getUser(c);
    const client = new FacebookGraphClient({
      apiVersion: c.env.FACEBOOK_GRAPH_API_VERSION,
    });

    const connected = await connectFacebookPage(
      client,
      async (page) =>
        socialAccountService.connectPlatformAccount(user, {
          platform: 'facebook',
          externalAccountId: page.id,
          displayName: page.name,
          accessToken: body.pageAccessToken,
        }),
      body,
    );

    const accounts = await socialAccountService.list(user);
    const account = accounts.find(
      (item) => item.platform === 'facebook' && item.externalAccountId === connected.pageId,
    );

    return c.json(
      {
        data: {
          account: account
            ? {
                id: account.id,
                platform: account.platform,
                externalAccountId: account.externalAccountId,
                displayName: account.displayName,
                status: account.status,
                createdAt: account.createdAt,
              }
            : null,
          pageId: connected.pageId,
          displayName: connected.displayName,
        },
      },
      201,
    );
  } catch (error) {
    return handleError(c, error);
  }
});

socialAccountRoutes.delete('/:id', async (c) => {
  try {
    const { socialAccountService } = getServices(c);
    await socialAccountService.disconnect(getUser(c), c.req.param('id'));
    return c.body(null, 204);
  } catch (error) {
    return handleError(c, error);
  }
});

export const publishRoutes = new Hono<HonoEnv>();

publishRoutes.post('/:id/publish', async (c) => {
  try {
    const body = publishContentSchema.parse(await c.req.json());
    const { publishingService } = getServices(c);
    const result = await publishingService.publishContentNow(getUser(c), {
      contentId: c.req.param('id'),
      socialAccountId: body.socialAccountId,
    });
    return c.json({ data: result }, result.disposition === 'published' ? 201 : 200);
  } catch (error) {
    return handleError(c, error);
  }
});
