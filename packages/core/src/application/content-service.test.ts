import { describe, expect, it } from 'vitest';
import {
  canTransitionContentStatus,
  type Content,
  type ContentStatus,
} from '../domain/content.js';
import { ContentService, type ContentRepository } from '../application/content-service.js';
import { ConflictError } from '../types/errors.js';

function createMockContent(overrides: Partial<Content> = {}): Content {
  return {
    id: 'content-1',
    userId: 'user-1',
    title: 'Test Title',
    body: 'Test body content',
    status: 'draft',
    contentType: 'text',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockRepository(
  content: Content = createMockContent(),
): ContentRepository {
  const store = new Map([[content.id, { ...content }]]);

  return {
    async create(input) {
      const created = createMockContent({
        id: 'content-new',
        userId: input.userId,
        title: input.title,
        body: input.body,
        contentType: input.contentType ?? 'text',
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
    async delete(id) {
      store.delete(id);
    },
  };
}

describe('Content domain', () => {
  it('allows valid status transitions', () => {
    expect(canTransitionContentStatus('draft', 'approved')).toBe(true);
    expect(canTransitionContentStatus('approved', 'scheduled')).toBe(true);
    expect(canTransitionContentStatus('publishing', 'published')).toBe(true);
  });

  it('rejects invalid status transitions', () => {
    expect(canTransitionContentStatus('published', 'draft')).toBe(false);
    expect(canTransitionContentStatus('cancelled', 'approved')).toBe(false);
  });
});

describe('ContentService', () => {
  it('creates content with validation', async () => {
    const service = new ContentService(createMockRepository());
    const content = await service.create({
      userId: 'user-1',
      title: 'Hello',
      body: 'World',
    });
    expect(content.title).toBe('Hello');
    expect(content.status).toBe('draft');
  });

  it('rejects empty title', async () => {
    const service = new ContentService(createMockRepository());
    await expect(
      service.create({ userId: 'user-1', title: '  ', body: 'body' }),
    ).rejects.toThrow('Title is required');
  });

  it('rejects invalid status transition', async () => {
    const content = createMockContent({ status: 'published' });
    const service = new ContentService(createMockRepository(content));
    await expect(service.update('content-1', { status: 'draft' })).rejects.toThrow(
      ConflictError,
    );
  });
});

describe('Content status transitions', () => {
  const validPaths: Array<[ContentStatus, ContentStatus]> = [
    ['draft', 'approved'],
    ['approved', 'scheduled'],
    ['scheduled', 'publishing'],
    ['publishing', 'published'],
    ['publishing', 'failed'],
    ['failed', 'draft'],
  ];

  it.each(validPaths)('allows %s -> %s', (from, to) => {
    expect(canTransitionContentStatus(from, to)).toBe(true);
  });
});
