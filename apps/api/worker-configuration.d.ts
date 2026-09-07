export interface Env {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  PUBLISH_QUEUE: Queue<{ scheduledPostId: string }>;
  AI: Ai;
  ENVIRONMENT: string;
  AI_PROVIDER: string;
  OPENAI_API_KEY?: string;
  CORS_ORIGIN?: string;
  TOKEN_WRAP_KEY?: string;
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
  TIKTOK_REDIRECT_URI?: string;
}
