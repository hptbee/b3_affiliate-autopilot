import { describe, expect, it } from 'vitest';
import { MockFacebookPublisher, MockTikTokPublisher } from '../providers/mock.js';
import type { PublishPostInput } from '@social-autopilot/core';

function createInput(platform: 'facebook' | 'tiktok'): PublishPostInput {
  return {
    content: {
      id: 'c1',
      userId: 'u1',
      title: 'Hook',
      body: 'Caption',
      status: 'approved',
      contentType: 'video',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    socialAccount: {
      id: 'a1',
      userId: 'u1',
      platform,
      externalAccountId: 'ext-1',
      displayName: 'Test',
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
      contentId: 'c1',
      socialAccountId: 'a1',
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
  };
}

describe('MockFacebookPublisher', () => {
  it('returns a deterministic mock external post ID', async () => {
    const publisher = new MockFacebookPublisher();
    const result = await publisher.publish(createInput('facebook'));
    expect(result.platform).toBe('facebook');
    expect(result.externalPostId).toBe('mock-facebook-post-1');
  });

  it('is idempotent for the same scheduledPostId', async () => {
    const publisher = new MockFacebookPublisher();
    const input = createInput('facebook');
    const r1 = await publisher.publish(input);
    const r2 = await publisher.publish(input);
    expect(r1.externalPostId).toBe(r2.externalPostId);
  });
});

describe('MockTikTokPublisher', () => {
  it('returns a deterministic mock external post ID', async () => {
    const publisher = new MockTikTokPublisher();
    const result = await publisher.publish(createInput('tiktok'));
    expect(result.platform).toBe('tiktok');
    expect(result.externalPostId).toBe('mock-tiktok-post-1');
  });

  it('is idempotent for the same scheduledPostId', async () => {
    const publisher = new MockTikTokPublisher();
    const input = createInput('tiktok');
    const r1 = await publisher.publish(input);
    const r2 = await publisher.publish(input);
    expect(r1.externalPostId).toBe(r2.externalPostId);
  });
});
