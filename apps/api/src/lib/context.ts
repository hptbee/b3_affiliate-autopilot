import { createAIProvider } from '@social-autopilot/ai';
import { createServices, CloudflarePublishQueue } from '@social-autopilot/database';
import { createSocialPublishers } from '@social-autopilot/social';
import { createShopeeAffiliateNetwork } from '@social-autopilot/affiliate';
import type { Env } from '../../worker-configuration';

export function createAppContext(env: Env) {
  const publishQueue = new CloudflarePublishQueue(env.PUBLISH_QUEUE);
  const publishers = createSocialPublishers();
  const affiliateNetwork = createShopeeAffiliateNetwork({
    appId: env.SHOPEE_AFFILIATE_APP_ID,
    secret: env.SHOPEE_AFFILIATE_SECRET,
    endpoint: env.SHOPEE_AFFILIATE_ENDPOINT,
  });

  const services = createServices({
    db: env.DB,
    publishQueue,
    publishers,
    affiliateNetwork,
  });

  const aiProvider = createAIProvider({
    type: env.AI_PROVIDER === 'openai' ? 'openai' : 'workers-ai',
    openaiApiKey: env.OPENAI_API_KEY,
    workersAiBinding: env.AI,
  });

  return { ...services, aiProvider };
}

export type AppContext = ReturnType<typeof createAppContext>;
