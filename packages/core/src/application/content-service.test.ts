import { describe, expect, it } from 'vitest';
import {
  canTransitionContentStatus,
  type Content,
  type ContentStatus,
} from '../domain/content.js';
import { ContentService, type ContentRepository } from '../application/content-service.js';
import { ConflictError } from '../types/errors.js';

const user = { userId: 'user-1' };
const other = { userId: 'user-2' };

function createMockContent(overrides: Partial<Content> = {}): Content {
  return {
    id: 'content-1',
    userId: 'user-1',
    title: 'Test Title',
    body: 'Test body content',
    status: 'draft',
    contentType: 'video',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockRepository(content: Content = createMockContent()): ContentRepository {
  const store = new Map([[content.id, { ...content }]]);

  return {
    async create(input) {
      const created = createMockContent({
        id: 'content-new',
        userId: input.userId,
        title: input.title,
        body: input.body,
        contentType: input.contentType ?? 'video',
      });
      store.set(created.id, created);
      return created;
    },
    async findById(id) {
      return store.get(id) ?? null;
    },
    async findByUserId(userId) {
      return [...store.values()].filter((c) => c.userId === userId);
    },
    async update(id, input) {
      const existing = store.get(id);
      if (!existing) throw new Error('not found');
      const updated = { ...existing, ...input, updatedAt: new Date() };
      store.set(id, updated);
      return updated;
    },
    async updateStatus(id, status) {
      const existing = store.get(id);
      if (!existing) throw new Error('not found');
      const updated = { ...existing, status, updatedAt: new Date() };
      store.set(id, updated);
      return updated;
    },
    async delete(id) {
      store.delete(id);
    },
  };
}

describe('Content domain', () => {
  it('allows draft → approved and approved → cancelled', () => {
    expect(canTransitionContentStatus('draft', 'approved')).toBe(true);
    expect(canTransitionContentStatus('approved', 'cancelled')).toBe(true);
    expect(canTransitionContentStatus('approved', 'archived')).toBe(true);
  });

  it('rejects publishing statuses on Content', () => {
    expect(canTransitionContentStatus('draft', 'published' as ContentStatus)).toBe(false);
    expect(canTransitionContentStatus('approved', 'scheduled' as ContentStatus)).toBe(false);
    expect(canTransitionContentStatus('cancelled', 'approved')).toBe(false);
  });
});

describe('ContentService', () => {
  it('creates content as draft video', async () => {
    const service = new ContentService(createMockRepository());
    const content = await service.create(user, {
      title: 'Hook',
      body: 'Script',
    });
    expect(content.title).toBe('Hook');
    expect(content.status).toBe('draft');
    expect(content.contentType).toBe('video');
  });

  it('rejects empty title', async () => {
    const service = new ContentService(createMockRepository());
    await expect(service.create(user, { title: '  ', body: 'body' })).rejects.toThrow(
      'Title is required',
    );
  });

  it('approves draft content', async () => {
    const service = new ContentService(createMockRepository());
    const approved = await service.approve(user, 'content-1');
    expect(approved.status).toBe('approved');
  });

  it('cannot update non-draft content', async () => {
    const content = createMockContent({ status: 'approved' });
    const service = new ContentService(createMockRepository(content));
    await expect(service.update(user, 'content-1', { title: 'Nope' })).rejects.toThrow(
      ConflictError,
    );
  });

  it('does not expose another user\'s content', async () => {
    const service = new ContentService(createMockRepository());
    await expect(service.getById(other, 'content-1')).rejects.toThrow('Content not found');
  });

  it('does not allow another user to approve', async () => {
    const service = new ContentService(createMockRepository());
    await expect(service.approve(other, 'content-1')).rejects.toThrow('Content not found');
  });
});
