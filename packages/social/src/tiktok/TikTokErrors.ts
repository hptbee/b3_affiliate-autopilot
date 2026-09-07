import { SocialPublishError } from '@social-autopilot/core';

export function mapTikTokHttpError(status: number, message: string): SocialPublishError {
  if (status === 401 || status === 403) {
    return new SocialPublishError(message, 'dead');
  }
  if (status >= 500) {
    return new SocialPublishError(message, 'failed');
  }
  if (status === 408 || status === 429) {
    return new SocialPublishError(message, 'failed');
  }
  return new SocialPublishError(message, 'dead');
}

export function mapTikTokNetworkError(error: unknown): SocialPublishError {
  const message = error instanceof Error ? error.message : 'TikTok network error';
  if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('abort')) {
    return new SocialPublishError(message, 'uncertain');
  }
  return new SocialPublishError(message, 'failed');
}
