import {
  ContentService,
  ScheduledPostService,
  PublishingService,
  SchedulerService,
  ProductService,
  SocialAccountService,
  createLogger,
  type Logger,
  type PublishQueue,
  type SocialPublisher,
  type SocialPlatform,
  type AffiliateNetwork,
  type TokenStore,
} from '@social-autopilot/core';
import { createDatabase } from './index.js';
import { DrizzleContentRepository } from './repositories/content-repository.js';
import { DrizzleScheduledPostRepository } from './repositories/scheduled-post-repository.js';
import { DrizzleSocialAccountRepository } from './repositories/social-account-repository.js';
import { DrizzleProductRepository } from './repositories/product-repository.js';
import { DrizzleAffiliateOfferRepository } from './repositories/affiliate-offer-repository.js';
import { DrizzleMediaRepository } from './repositories/media-repository.js';
import { R2MediaStorage } from './storage/r2-media-storage.js';

export interface ServiceContainer {
  contentService: ContentService;
  contentRepository: DrizzleContentRepository;
  scheduledPostService: ScheduledPostService;
  publishingService: PublishingService;
  schedulerService: SchedulerService;
  productService: ProductService;
  socialAccountService: SocialAccountService;
  socialAccountRepository: DrizzleSocialAccountRepository;
  mediaRepository: DrizzleMediaRepository;
  logger: Logger;
}

export interface CreateServicesOptions {
  db: D1Database;
  publishQueue: PublishQueue;
  publishers: Map<SocialPlatform, SocialPublisher>;
  affiliateNetwork: AffiliateNetwork;
  tokenStore: TokenStore;
  mediaBucket: R2Bucket;
  logger?: Logger;
}

export function createServices(options: CreateServicesOptions): ServiceContainer {
  const database = createDatabase(options.db);
  const logger = options.logger ?? createLogger('social-autopilot');

  const contentRepository = new DrizzleContentRepository(database);
  const scheduledPostRepository = new DrizzleScheduledPostRepository(database);
  const socialAccountRepository = new DrizzleSocialAccountRepository(database);
  const productRepository = new DrizzleProductRepository(database);
  const affiliateOfferRepository = new DrizzleAffiliateOfferRepository(database);
  const mediaRepository = new DrizzleMediaRepository(database);
  const mediaStorage = new R2MediaStorage(options.mediaBucket);

  const contentService = new ContentService(contentRepository);
  const scheduledPostService = new ScheduledPostService(
    scheduledPostRepository,
    contentRepository,
    socialAccountRepository,
  );

  const socialAccountService = new SocialAccountService(socialAccountRepository, options.tokenStore);

  const publishingService = new PublishingService(
    scheduledPostRepository,
    contentRepository,
    socialAccountRepository,
    options.publishers,
    logger,
    options.tokenStore,
    mediaRepository,
    mediaStorage,
  );

  const schedulerService = new SchedulerService(
    scheduledPostRepository,
    options.publishQueue,
    logger,
  );

  const productService = new ProductService(
    productRepository,
    affiliateOfferRepository,
    options.affiliateNetwork,
  );

  return {
    contentService,
    contentRepository,
    scheduledPostService,
    publishingService,
    schedulerService,
    productService,
    socialAccountService,
    socialAccountRepository,
    mediaRepository,
    logger,
  };
}
