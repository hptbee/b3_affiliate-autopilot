import { describe, expect, it, vi } from 'vitest';
import type { PublishPostInput, PublishMediaAttachment } from '@social-autopilot/core';
import { SocialPublishError } from '@social-autopilot/core';
import { FacebookGraphClient } from './client.js';
import { mapFacebookError } from './errors.js';
import {
  FacebookPublisher,
  buildPostMessage,
  connectFacebookPage,
  selectPublishablePhoto,
} from './publisher.js';

function createInput(overrides: Partial<PublishPostInput> = {}): PublishPostInput {
  return {
    content: {
      id: 'content-1',
      userId: 'user-1',
      title: 'Hook line',
      body: 'Caption with affiliate link https://shope.ee/example',
      status: 'approved',
      contentType: 'video',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    socialAccount: {
      id: 'account-1',
      userId: 'user-1',
      platform: 'facebook',
      externalAccountId: 'page-123',
      displayName: 'Test Page',
      accessTokenRef: 'facebook:user-1:page-123',
      refreshTokenRef: null,
      tokenExpiresAt: null,
      metadata: {},
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    scheduledPost: {
      id: 'post-1',
      contentId: 'content-1',
      socialAccountId: 'account-1',
      scheduledAt: new Date(),
      status: 'publishing',
      publishedAt: null,
      externalPostId: null,
      error: null,
      retryCount: 0,
      queuedAt: null,
      publishingStartedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    idempotencyKey: 'post-1',
    accessToken: 'page-token',
    mediaAttachments: [],
    ...overrides,
  };
}

function pngAttachment(): PublishMediaAttachment {
  const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return {
    id: 'media-1',
    mimeType: 'image/png',
    mediaType: 'image',
    body: bytes.buffer,
  };
}

describe('FacebookPublisher', () => {
  it('publishes a text-only feed post when media is SVG', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: 'feed-post-1' }, { status: 200 }),
    );
    const publisher = new FacebookPublisher({ http: { fetch: fetchMock } });

    const result = await publisher.publish(
      createInput({
        mediaAttachments: [
          {
            id: 'svg-1',
            mimeType: 'image/svg+xml',
            mediaType: 'image',
            body: new TextEncoder().encode('<svg></svg>').buffer,
          },
        ],
      }),
    );

    expect(result.externalPostId).toBe('feed-post-1');
    expect(fetchMock).toHaveBeenCalledOnce();
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls[0][0]).toContain('/page-123/feed');
    expect(calls[0][1].method).toBe('POST');
    const form = calls[0][1].body as FormData;
    expect(form.get('message')).toContain('Hook line');
  });

  it('publishes a photo post for raster images', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: 'photo-1', post_id: 'feed-post-2' }, { status: 200 }),
    );
    const publisher = new FacebookPublisher({ http: { fetch: fetchMock } });

    const result = await publisher.publish(
      createInput({
        mediaAttachments: [pngAttachment()],
      }),
    );

    expect(result.externalPostId).toBe('feed-post-2');
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls[0][0]).toContain('/page-123/photos');
  });

  it('maps invalid token errors to dead', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        { error: { message: 'Invalid OAuth access token', code: 190 } },
        { status: 400 },
      ),
    );
    const publisher = new FacebookPublisher({ http: { fetch: fetchMock } });

    await expect(publisher.publish(createInput())).rejects.toMatchObject({
      outcome: 'dead',
    });
  });

  it('maps rate limits to retryable failed', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ error: { message: 'Rate limit', code: 4 } }, { status: 429 }),
    );
    const publisher = new FacebookPublisher({ http: { fetch: fetchMock } });

    await expect(publisher.publish(createInput())).rejects.toMatchObject({
      outcome: 'failed',
    });
  });
});

describe('facebook helpers', () => {
  it('builds post message from title and body', () => {
    expect(
      buildPostMessage({
        id: 'c',
        userId: 'u',
        title: 'Title',
        body: 'Body',
        status: 'approved',
        contentType: 'text',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).toBe('Title\n\nBody');
  });

  it('skips SVG when selecting publishable photos', () => {
    const selected = selectPublishablePhoto([
      {
        id: 'svg',
        mimeType: 'image/svg+xml',
        mediaType: 'image',
        body: new ArrayBuffer(8),
      },
      pngAttachment(),
    ]);
    expect(selected?.mimeType).toBe('image/png');
  });

  it('verifies page id during connect', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ id: 'page-999', name: 'Verified Page' }, { status: 200 }),
    );
    const client = new FacebookGraphClient({ http: { fetch: fetchMock } });
    const connect = vi.fn(async () => undefined);

    await expect(
      connectFacebookPage(client, connect, {
        pageId: 'page-123',
        pageAccessToken: 'token',
      }),
    ).rejects.toBeInstanceOf(SocialPublishError);
  });

  it('classifies server errors as uncertain', () => {
    const error = Object.assign(new Error('Server error'), {
      facebookError: { message: 'Server error', code: 2 },
      status: 500,
    });
    expect(mapFacebookError(error).outcome).toBe('uncertain');
  });
});
