import {
  ContentService,
  ScheduledPostService,
  PublishingService,
  SchedulerService,
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

export interface ServiceContainer {
  contentService: ContentService;
  scheduledPostService: ScheduledPostService;
  publishingService: PublishingService;
  schedulerService: SchedulerService;
  socialAccountRepository: DrizzleSocialAccountRepository;
  logger: Logger;
}

export interface CreateServicesOptions {
  db: D1Database;
  publishQueue: PublishQueue;
  publishers: Map<SocialPlatform, SocialPublisher>;
  logger?: Logger;
}

export function createServices(options: CreateServicesOptions): ServiceContainer {
  const database = createDatabase(options.db);
  const logger = options.logger ?? createLogger('social-autopilot');

  const contentRepository = new DrizzleContentRepository(database);
  const scheduledPostRepository = new DrizzleScheduledPostRepository(database);
  const socialAccountRepository = new DrizzleSocialAccountRepository(database);

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

  return {
    contentService,
    scheduledPostService,
    publishingService,
    schedulerService,
    socialAccountRepository,
    logger,
  };
}
