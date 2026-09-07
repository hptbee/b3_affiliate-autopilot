import {
  ContentService,
  MediaService,
  ScheduledPostService,
  PublishingService,
  SchedulerService,
  SocialAccountService,
  createLogger,
  type Logger,
  type PublishQueue,
  type SocialPublisher,
  type SocialPlatform,
} from '@social-autopilot/core';
import { createDatabase } from './index.js';
import { DrizzleContentRepository } from './repositories/content-repository.js';
import { DrizzleScheduledPostRepository } from './repositories/scheduled-post-repository.js';
import { DrizzleSocialAccountRepository } from './repositories/social-account-repository.js';
import { DrizzleMediaRepository } from './repositories/media-repository.js';
import { DrizzleOAuthStateRepository } from './repositories/oauth-state-repository.js';
import { EncryptedD1TokenStore } from './token-store/encrypted-d1-token-store.js';
import { R2MediaStorage } from './storage/r2-media-storage.js';
import type { TikTokOAuthClient } from '@social-autopilot/core';

export interface ServiceContainer {
  contentService: ContentService;
  scheduledPostService: ScheduledPostService;
  publishingService: PublishingService;
  schedulerService: SchedulerService;
  socialAccountService: SocialAccountService;
  mediaService: MediaService;
  socialAccountRepository: DrizzleSocialAccountRepository;
  logger: Logger;
}

export interface CreateServicesOptions {
  db: D1Database;
  mediaBucket: R2Bucket;
  bucketName: string;
  publishQueue: PublishQueue;
  publishers: Map<SocialPlatform, SocialPublisher>;
  tokenWrapKey: string;
  tiktokOAuth?: TikTokOAuthClient;
  logger?: Logger;
}

export function createServices(options: CreateServicesOptions): ServiceContainer {
  const database = createDatabase(options.db);
  const logger = options.logger ?? createLogger('social-autopilot');

  const contentRepository = new DrizzleContentRepository(database);
  const scheduledPostRepository = new DrizzleScheduledPostRepository(database);
  const socialAccountRepository = new DrizzleSocialAccountRepository(database);
  const mediaRepository = new DrizzleMediaRepository(database);
  const oauthStateRepository = new DrizzleOAuthStateRepository(database);
  const tokenStore = new EncryptedD1TokenStore(database, options.tokenWrapKey);
  const mediaStorage = new R2MediaStorage(options.mediaBucket);

  const contentService = new ContentService(contentRepository);
  const mediaService = new MediaService(
    mediaRepository,
    contentRepository,
    mediaStorage,
    options.bucketName,
  );

  const tiktokOAuth = options.tiktokOAuth;
  if (!tiktokOAuth) {
    throw new Error('TikTok OAuth client is required');
  }

  const socialAccountService = new SocialAccountService(
    socialAccountRepository,
    tokenStore,
    oauthStateRepository,
    tiktokOAuth,
  );

  const scheduledPostService = new ScheduledPostService(
    scheduledPostRepository,
    contentRepository,
    socialAccountRepository,
    mediaRepository,
  );

  const publishingService = new PublishingService(
    scheduledPostRepository,
    contentRepository,
    socialAccountRepository,
    options.publishers,
    logger,
  );

  const schedulerService = new SchedulerService(
    scheduledPostRepository,
    options.publishQueue,
    logger,
  );

  return {
    contentService,
    scheduledPostService,
    publishingService,
    schedulerService,
    socialAccountService,
    mediaService,
    socialAccountRepository,
    logger,
  };
}
