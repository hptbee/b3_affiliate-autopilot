import { describe, expect, it } from 'vitest';
import { MockSocialPublisher } from '../providers/mock.js';

describe('MockSocialPublisher', () => {
  it('returns mock external post ID', async () => {
    const publisher = new MockSocialPublisher('linkedin');
    const result = await publisher.publish({
      content: { id: 'c1', title: 'Title', body: 'Body' },
      socialAccount: {
        id: 'a1',
        platform: 'linkedin',
        externalAccountId: 'ext-1',
        displayName: 'Test',
      },
    });

    expect(result.platform).toBe('linkedin');
    expect(result.externalPostId).toContain('mock-linkedin-c1');
    expect(result.publishedAt).toBeInstanceOf(Date);
  });

  it('creates unique IDs per publish', async () => {
    const publisher = new MockSocialPublisher('x');
    const input = {
      content: { id: 'c1', title: 'T', body: 'B' },
      socialAccount: {
        id: 'a1',
        platform: 'x' as const,
        externalAccountId: 'ext-1',
        displayName: 'Test',
      },
    };

    const r1 = await publisher.publish(input);
    await new Promise((r) => setTimeout(r, 5));
    const r2 = await publisher.publish(input);

    expect(r1.externalPostId).not.toBe(r2.externalPostId);
  });
});
