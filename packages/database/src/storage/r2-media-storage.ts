import type { MediaGetResult, MediaPutInput, MediaPutResult, MediaStorage } from '@social-autopilot/core';

export class R2MediaStorage implements MediaStorage {
  constructor(private readonly bucket: R2Bucket) {}

  async put(input: MediaPutInput): Promise<MediaPutResult> {
    const object = await this.bucket.put(input.key, input.body, {
      httpMetadata: { contentType: input.mimeType },
      customMetadata: input.metadata,
    });
    return {
      key: input.key,
      size: object.size,
    };
  }

  async get(key: string): Promise<MediaGetResult | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;

    return {
      body: object.body,
      mimeType: object.httpMetadata?.contentType ?? 'application/octet-stream',
      size: object.size,
      metadata: object.customMetadata ?? {},
    };
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }
}
