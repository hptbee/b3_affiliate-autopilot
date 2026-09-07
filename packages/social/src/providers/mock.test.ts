import { describe, expect, it } from 'vitest';
import { MockTikTokPublisher } from '../providers/mock.js';

const input = {
  content: {
    id: 'c1',
    userId: 'u1',
    title: 'Hook',
    body: 'Caption',
    status: 'approved' as const,
    contentType: 'video' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  socialAccount: {
    id: 'a1',
    userId: 'u1',
    platform: 'tiktok' as const,
    externalAccountId: 'ext-1',
    displayName: 'Test',
    accessTokenRef: 'ref',
    refreshTokenRef: null,
    tokenExpiresAt: null,
    metadata: {},
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  scheduledPost: {
    id: 'post-1',
    contentId: 'c1',
    socialAccountId: 'a1',
    scheduledAt: new Date(),
    privacyLevel: 'self_only' as const,
    status: 'publishing' as const,
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
  caption: 'Caption',
};

describe('MockTikTokPublisher', () => {
  it('returns a deterministic mock external post ID', async () => {
    const publisher = new MockTikTokPublisher();
    const result = await publisher.publish(input);
    expect(result.platform).toBe('tiktok');
    expect(result.externalPostId).toBe('mock-tiktok-post-1');
  });

  it('is idempotent for the same scheduledPostId', async () => {
    const publisher = new MockTikTokPublisher();
    const r1 = await publisher.publish(input);
    const r2 = await publisher.publish(input);
    expect(r1.externalPostId).toBe(r2.externalPostId);
  });
});
