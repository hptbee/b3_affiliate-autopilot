import { createAIProvider } from '@social-autopilot/ai';
import { createServices, CloudflarePublishQueue } from '@social-autopilot/database';
import { createSocialPublishers, adaptSocialPublishers } from '@social-autopilot/social';
import type { Env } from '../../worker-configuration';

export function createAppContext(env: Env) {
  const publishQueue = new CloudflarePublishQueue(env.PUBLISH_QUEUE);
  const publishers = adaptSocialPublishers(createSocialPublishers());

  const services = createServices({
    db: env.DB,
    publishQueue,
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
