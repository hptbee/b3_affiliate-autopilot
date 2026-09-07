import { SocialPublishError } from '@social-autopilot/core';
import { mapTikTokHttpError, mapTikTokNetworkError } from './TikTokErrors.js';

export interface TikTokClientConfig {
  accessToken: string;
}

export interface TikTokVideoInitResult {
  publishId: string;
  uploadUrl: string;
}

export class TikTokClient {
  private static readonly INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
  private static readonly PUBLISH_URL = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';

  constructor(private readonly config: TikTokClientConfig) {}

  async initVideoUpload(input: {
    caption: string;
    privacyLevel: 'SELF_ONLY' | 'PUBLIC_TO_EVERYONE';
    videoSize: number;
  }): Promise<TikTokVideoInitResult> {
    try {
      const response = await fetch(TikTokClient.INIT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          post_info: {
            title: input.caption,
            privacy_level: input.privacyLevel,
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: input.videoSize,
            chunk_size: input.videoSize,
            total_chunk_count: 1,
          },
        }),
      });

      const json = (await response.json()) as {
        data?: { publish_id?: string; upload_url?: string };
        error?: { message?: string };
      };

      if (!response.ok || !json.data?.publish_id || !json.data.upload_url) {
        throw mapTikTokHttpError(
          response.status,
          json.error?.message ?? 'TikTok video init failed',
        );
      }

      return {
        publishId: json.data.publish_id,
        uploadUrl: json.data.upload_url,
      };
    } catch (error) {
      if (error instanceof SocialPublishError) {
        throw error;
      }
      throw mapTikTokNetworkError(error);
    }
  }

  async uploadVideo(uploadUrl: string, videoBytes: ArrayBuffer, mimeType: string): Promise<void> {
    try {
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(videoBytes.byteLength),
        },
        body: videoBytes,
      });

      if (!response.ok) {
        throw mapTikTokHttpError(response.status, 'TikTok video upload failed');
      }
    } catch (error) {
      if (error instanceof SocialPublishError) {
        throw error;
      }
      throw mapTikTokNetworkError(error);
    }
  }

  async waitForPublish(publishId: string): Promise<string> {
    try {
      const response = await fetch(TikTokClient.PUBLISH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ publish_id: publishId }),
      });

      const json = (await response.json()) as {
        data?: { status?: string; publicaly_available_post_id?: string[] };
        error?: { message?: string };
      };

      if (!response.ok) {
        throw mapTikTokHttpError(
          response.status,
          json.error?.message ?? 'TikTok publish status failed',
        );
      }

      const status = json.data?.status;
      const postId = json.data?.publicaly_available_post_id?.[0];

      if (status === 'FAILED') {
        throw mapTikTokHttpError(400, 'TikTok publish failed');
      }

      if (status === 'PROCESSING_UPLOAD' || status === 'PROCESSING_DOWNLOAD') {
        throw mapTikTokHttpError(408, 'TikTok publish still processing');
      }

      if (!postId) {
        throw mapTikTokHttpError(500, 'TikTok publish returned no post id');
      }

      return postId;
    } catch (error) {
      if (error instanceof SocialPublishError) {
        throw error;
      }
      throw mapTikTokNetworkError(error);
    }
  }
}
