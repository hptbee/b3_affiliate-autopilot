import { z } from 'zod';
import type { ContentService, ScheduledPostService, SocialAccountRepository, UserContext } from '@social-autopilot/core';
import type { AgentTool } from '../agents/types.js';

export function createContentTool(
  contentService: ContentService,
  user: UserContext,
): AgentTool<{ title: string; body: string }, { id: string; status: string }> {
  return {
    name: 'create_content',
    description: 'Create a new TikTok content draft',
    inputSchema: z.object({
      title: z.string().min(1),
      body: z.string().min(1),
    }),
    async execute(input) {
      const content = await contentService.create(user, input);
      return { id: content.id, status: content.status };
    },
  };
}

export function updateContentTool(
  contentService: ContentService,
  user: UserContext,
): AgentTool<{ id: string; title?: string; body?: string }, { id: string; status: string }> {
  return {
    name: 'update_content',
    description: 'Update a draft (cannot change lifecycle status)',
    inputSchema: z.object({
      id: z.string().uuid(),
      title: z.string().min(1).optional(),
      body: z.string().min(1).optional(),
    }),
    async execute(input) {
      const { id, ...updates } = input;
      const content = await contentService.update(user, id, updates);
      return { id: content.id, status: content.status };
    },
  };
}

export function getContentTool(
  contentService: ContentService,
  user: UserContext,
): AgentTool<{ id: string }, { id: string; title: string; body: string; status: string }> {
  return {
    name: 'get_content',
    description: 'Get content by ID for the current user',
    inputSchema: z.object({ id: z.string().uuid() }),
    async execute(input) {
      const content = await contentService.getById(user, input.id);
      return {
        id: content.id,
        title: content.title,
        body: content.body,
        status: content.status,
      };
    },
  };
}

export function approveContentTool(
  contentService: ContentService,
  user: UserContext,
): AgentTool<{ id: string }, { id: string; status: string }> {
  return {
    name: 'approve_content',
    description: 'Approve a draft. Human-gated; not for autonomous agents.',
    inputSchema: z.object({ id: z.string().uuid() }),
    async execute(input) {
      const content = await contentService.approve(user, input.id);
      return { id: content.id, status: content.status };
    },
  };
}

export function schedulePostTool(
  scheduledPostService: ScheduledPostService,
  user: UserContext,
): AgentTool<
  { contentId: string; socialAccountId: string; scheduledAt: string },
  { id: string; status: string }
> {
  return {
    name: 'schedule_post',
    description: 'Schedule an approved TikTok post. Requires human approval first.',
    inputSchema: z.object({
      contentId: z.string().uuid(),
      socialAccountId: z.string().uuid(),
      scheduledAt: z.string().datetime(),
    }),
    async execute(input) {
      const post = await scheduledPostService.create(user, {
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
  user: UserContext,
): AgentTool<{ id: string }, { id: string; status: string }> {
  return {
    name: 'cancel_scheduled_post',
    description: 'Cancel a scheduled TikTok post',
    inputSchema: z.object({ id: z.string().uuid() }),
    async execute(input) {
      const post = await scheduledPostService.cancel(user, input.id);
      return { id: post.id, status: post.status };
    },
  };
}

export function listSocialAccountsTool(
  socialAccountRepository: SocialAccountRepository,
  user: UserContext,
): AgentTool<
  Record<string, never>,
  Array<{ id: string; platform: string; displayName: string; status: string }>
> {
  return {
    name: 'list_social_accounts',
    description: 'List connected TikTok accounts for the current user',
    inputSchema: z.object({}),
    async execute() {
      const accounts = await socialAccountRepository.findByUserId(user.userId);
      return accounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        displayName: a.displayName,
        status: a.status,
      }));
    },
  };
}
