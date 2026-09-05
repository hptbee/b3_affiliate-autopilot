import type { PublishQueue, PublishQueueMessage } from '@social-autopilot/core';

export class CloudflarePublishQueue implements PublishQueue {
  constructor(private readonly queue: Queue<PublishQueueMessage>) {}

  async send(message: PublishQueueMessage): Promise<void> {
    await this.queue.send(message);
  }

  async sendBatch(messages: PublishQueueMessage[]): Promise<void> {
    await this.queue.sendBatch(messages.map((body) => ({ body })));
  }
}
