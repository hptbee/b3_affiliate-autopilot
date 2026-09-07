import { createAIProvider, createAffiliateContentGenerator, createAffiliateCoverMediaGenerator } from '@social-autopilot/ai';
import { AffiliateContentService, MediaService } from '@social-autopilot/core';
import {
  createDatabase,
  createServices,
  CloudflarePublishQueue,
  DrizzleMediaRepository,
  R2MediaStorage,
} from '@social-autopilot/database';
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

  const affiliateContentGenerator = createAffiliateContentGenerator(aiProvider);
  const affiliateContentService = new AffiliateContentService(
    services.productService,
    services.contentService,
    affiliateContentGenerator,
  );

  const database = createDatabase(env.DB);
  const mediaRepository = new DrizzleMediaRepository(database);
  const mediaStorage = new R2MediaStorage(env.MEDIA_BUCKET);
  const coverMediaGenerator = createAffiliateCoverMediaGenerator(aiProvider);
  const mediaService = new MediaService(
    services.contentService,
    services.productService,
    mediaRepository,
    mediaStorage,
    coverMediaGenerator,
    'social-autopilot-media',
  );

  return { ...services, aiProvider, affiliateContentService, mediaService };
}

export type AppContext = ReturnType<typeof createAppContext>;
