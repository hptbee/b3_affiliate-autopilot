import { z } from 'zod';
import type { ContentService, ContentStatus } from '@social-autopilot/core';
import type { ScheduledPostService } from '@social-autopilot/core';
import type { SocialAccountRepository } from '@social-autopilot/core';
import type { AgentTool } from '../agents/types.js';

export function createContentTool(contentService: ContentService): AgentTool<
  { userId: string; title: string; body: string },
  { id: string; status: string }
> {
  return {
    name: 'create_content',
    description: 'Create a new content draft',
    inputSchema: z.object({
      userId: z.string().uuid(),
      title: z.string().min(1),
      body: z.string().min(1),
    }),
    async execute(input) {
      const content = await contentService.create(input);
      return { id: content.id, status: content.status };
    },
  };
}

export function updateContentTool(contentService: ContentService): AgentTool<
  { id: string; title?: string; body?: string; status?: string },
  { id: string; status: string }
> {
  return {
    name: 'update_content',
    description: 'Update existing content',
    inputSchema: z.object({
      id: z.string().uuid(),
      title: z.string().min(1).optional(),
      body: z.string().min(1).optional(),
      status: z
        .enum(['draft', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'])
        .optional(),
    }),
    async execute(input) {
      const { id, ...updates } = input;
      const content = await contentService.update(id, {
        ...updates,
        status: updates.status as ContentStatus | undefined,
      });
      return { id: content.id, status: content.status };
    },
  };
}

export function getContentTool(contentService: ContentService): AgentTool<
  { id: string },
  { id: string; title: string; body: string; status: string }
> {
  return {
    name: 'get_content',
    description: 'Get content by ID',
    inputSchema: z.object({ id: z.string().uuid() }),
    async execute(input) {
      const content = await contentService.getById(input.id);
      return {
        id: content.id,
        title: content.title,
        body: content.body,
        status: content.status,
      };
    },
  };
}

export function schedulePostTool(
  scheduledPostService: ScheduledPostService,
): AgentTool<
  { contentId: string; socialAccountId: string; scheduledAt: string },
  { id: string; status: string }
> {
  return {
    name: 'schedule_post',
    description: 'Schedule a post for publishing',
    inputSchema: z.object({
      contentId: z.string().uuid(),
      socialAccountId: z.string().uuid(),
      scheduledAt: z.string().datetime(),
    }),
    async execute(input) {
      const post = await scheduledPostService.create({
        contentId: input.contentId,
        socialAccountId: input.socialAccountId,
        scheduledAt: new Date(input.scheduledAt),
      });
      return { id: post.id, status: post.status };
    },
  };
}

export function cancelScheduledPostTool(
  scheduledPostService: ScheduledPostService,
): AgentTool<{ id: string }, { id: string; status: string }> {
  return {
    name: 'cancel_scheduled_post',
    description: 'Cancel a scheduled post',
    inputSchema: z.object({ id: z.string().uuid() }),
    async execute(input) {
      const post = await scheduledPostService.cancel(input.id);
      return { id: post.id, status: post.status };
    },
  };
}

export function listSocialAccountsTool(
  socialAccountRepository: SocialAccountRepository,
): AgentTool<
  { userId: string },
  Array<{ id: string; platform: string; displayName: string; status: string }>
> {
  return {
    name: 'list_social_accounts',
    description: 'List connected social accounts for a user',
    inputSchema: z.object({ userId: z.string().uuid() }),
    async execute(input) {
      const accounts = await socialAccountRepository.findByUserId(input.userId);
      return accounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        displayName: a.displayName,
        status: a.status,
      }));
    },
  };
}

export function publishPostTool(): AgentTool<
  { scheduledPostId: string },
  { message: string }
> {
  return {
    name: 'publish_post',
    description: 'Immediately publish a scheduled post (stub - use publishing service)',
    inputSchema: z.object({ scheduledPostId: z.string().uuid() }),
    async execute() {
      return { message: 'Publish is handled by the publishing worker queue' };
    },
  };
}
