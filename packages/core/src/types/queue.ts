export interface PublishQueueMessage {
  scheduledPostId: string;
}

export interface PublishQueue {
  send(message: PublishQueueMessage): Promise<void>;
  sendBatch(messages: PublishQueueMessage[]): Promise<void>;
}
