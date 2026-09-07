import { createAIProvider } from '@social-autopilot/ai';
import {
  createServices,
  CloudflarePublishQueue,
  type ServiceContainer,
} from '@social-autopilot/database';
import { createSocialPublishers, TikTokOAuth } from '@social-autopilot/social';
import type { Env } from '../../worker-configuration';

const DEV_TOKEN_WRAP_KEY = 'dev-only-wrap-key-32-bytes!!';

export function hasTikTokConfig(env: Env): boolean {
  return !!(
    env.TIKTOK_CLIENT_KEY &&
    env.TIKTOK_CLIENT_SECRET &&
    env.TIKTOK_REDIRECT_URI &&
    env.TOKEN_WRAP_KEY
  );
}

export function createAppContext(
  env: Env,
): ServiceContainer & { aiProvider: ReturnType<typeof createAIProvider> } {
  const publishQueue = new CloudflarePublishQueue(env.PUBLISH_QUEUE);
  const tiktokConfigured = hasTikTokConfig(env);
  const tiktokOAuth = new TikTokOAuth({
    clientKey: env.TIKTOK_CLIENT_KEY ?? 'disabled',
    clientSecret: env.TIKTOK_CLIENT_SECRET ?? 'disabled',
    redirectUri: env.TIKTOK_REDIRECT_URI ?? 'http://localhost:8787/api/oauth/tiktok/callback',
  });

  const baseServices = createServices({
    db: env.DB,
    mediaBucket: env.MEDIA_BUCKET,
    bucketName: 'social-autopilot-media',
    publishQueue,
    tokenWrapKey: env.TOKEN_WRAP_KEY ?? DEV_TOKEN_WRAP_KEY,
    tiktokOAuth,
    publishers: createSocialPublishers({ tiktokConfigured: false }),
  });

  const publishers = createSocialPublishers({
    tiktokConfigured,
    tiktokDeps: tiktokConfigured
      ? {
          getAccessToken: async (socialAccountId) => {
            const account = await baseServices.socialAccountRepository.findById(socialAccountId);
            if (!account) throw new Error('Social account not found');
            return baseServices.socialAccountService.refreshIfNeeded(account);
          },
          getVideoBytes: async (contentId) => baseServices.mediaService.getBytesForContent(contentId),
        }
      : undefined,
  });

  const services = createServices({
    db: env.DB,
    mediaBucket: env.MEDIA_BUCKET,
    bucketName: 'social-autopilot-media',
    publishQueue,
    tokenWrapKey: env.TOKEN_WRAP_KEY ?? DEV_TOKEN_WRAP_KEY,
    tiktokOAuth,
    publishers,
  });

  const aiProvider = createAIProvider({
    type: env.AI_PROVIDER === 'openai' ? 'openai' : 'workers-ai',
    openaiApiKey: env.OPENAI_API_KEY,
    workersAiBinding: env.AI,
  });

  return { ...services, aiProvider };
}

export type AppContext = ReturnType<typeof createAppContext>;
