import {
  ContentService,
  ScheduledPostService,
  PublishingService,
  SchedulerService,
  ProductService,
  createLogger,
  type Logger,
  type PublishQueue,
  type SocialPublisher,
  type SocialPlatform,
  type AffiliateNetwork,
} from '@social-autopilot/core';
import { createDatabase } from './index.js';
import { DrizzleContentRepository } from './repositories/content-repository.js';
import { DrizzleScheduledPostRepository } from './repositories/scheduled-post-repository.js';
import { DrizzleSocialAccountRepository } from './repositories/social-account-repository.js';
import { DrizzleProductRepository } from './repositories/product-repository.js';
import { DrizzleAffiliateOfferRepository } from './repositories/affiliate-offer-repository.js';

export interface ServiceContainer {
  contentService: ContentService;
  scheduledPostService: ScheduledPostService;
  publishingService: PublishingService;
  schedulerService: SchedulerService;
  productService: ProductService;
  socialAccountRepository: DrizzleSocialAccountRepository;
  logger: Logger;
}

export interface CreateServicesOptions {
  db: D1Database;
  publishQueue: PublishQueue;
  publishers: Map<SocialPlatform, SocialPublisher>;
  affiliateNetwork: AffiliateNetwork;
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

  const contentService = new ContentService(contentRepository);
  const scheduledPostService = new ScheduledPostService(
    scheduledPostRepository,
    contentRepository,
    socialAccountRepository,
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

  const productService = new ProductService(
    productRepository,
    affiliateOfferRepository,
    options.affiliateNetwork,
  );

  return {
    contentService,
    scheduledPostService,
    publishingService,
    schedulerService,
    productService,
    socialAccountRepository,
    logger,
  };
}
