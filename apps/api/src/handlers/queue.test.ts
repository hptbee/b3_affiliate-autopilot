import { describe, expect, it, vi, beforeEach } from 'vitest';
import { queue } from './queue.js';

const publishScheduledPost = vi.fn();

vi.mock('../lib/context.js', () => ({
  createAppContext: () => ({
    publishingService: { publishScheduledPost },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }),
}));

function createMessage(scheduledPostId: string) {
  return {
    body: { scheduledPostId },
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

describe('queue handler', () => {
  beforeEach(() => {
    publishScheduledPost.mockReset();
  });

  it('acks published outcomes', async () => {
    publishScheduledPost.mockResolvedValue({
      queueAction: 'ack',
      disposition: 'published',
    });
    const message = createMessage('post-1');

    await queue({ messages: [message] } as MessageBatch<{ scheduledPostId: string }>, {} as never);

    expect(message.ack).toHaveBeenCalledOnce();
    expect(message.retry).not.toHaveBeenCalled();
  });

  it('acks uncertain and dead outcomes', async () => {
    for (const disposition of ['uncertain', 'dead', 'already_published'] as const) {
      publishScheduledPost.mockResolvedValueOnce({ queueAction: 'ack', disposition });
      const message = createMessage(`post-${disposition}`);

      await queue(
        { messages: [message] } as MessageBatch<{ scheduledPostId: string }>,
        {} as never,
      );

      expect(message.ack).toHaveBeenCalledOnce();
      expect(message.retry).not.toHaveBeenCalled();
    }
  });

  it('retries only failed outcomes', async () => {
    publishScheduledPost.mockResolvedValue({
      queueAction: 'retry',
      disposition: 'failed',
    });
    const message = createMessage('post-failed');

    await queue({ messages: [message] } as MessageBatch<{ scheduledPostId: string }>, {} as never);

    expect(message.retry).toHaveBeenCalledOnce();
    expect(message.ack).not.toHaveBeenCalled();
  });
});
