import { describe, expect, it, vi } from 'vitest';
import { TikTokPublisher } from './TikTokPublisher.js';

describe('TikTokPublisher', () => {
  it('publishes using resolved token and video bytes', async () => {
    const publisher = new TikTokPublisher({
      getAccessToken: vi.fn(async () => 'access-token'),
      getVideoBytes: vi.fn(async () => ({
        bytes: new Uint8Array([1, 2, 3]).buffer,
        mimeType: 'video/mp4',
      })),
    });

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { publish_id: 'publish-1', upload_url: 'https://upload.test/video' },
          }),
        })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: ['post-123'] },
          }),
        }),
    );

    const result = await publisher.publish({
      content: {
        id: 'content-1',
        userId: 'user-1',
        title: 'Hook',
        body: 'Caption',
        status: 'approved',
        contentType: 'video',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      socialAccount: {
        id: 'account-1',
        userId: 'user-1',
        platform: 'tiktok',
        externalAccountId: 'open-1',
        displayName: 'TikTok',
        accessTokenRef: 'ref',
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
        privacyLevel: 'self_only',
        status: 'scheduled',
        publishedAt: null,
        externalPostId: null,
        error: null,
        retryCount: 0,
        queuedAt: null,
        publishingStartedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      idempotencyKey: 'post-1',
      caption: 'Caption',
    });

    expect(result.externalPostId).toBe('post-123');
    vi.unstubAllGlobals();
  });
});
