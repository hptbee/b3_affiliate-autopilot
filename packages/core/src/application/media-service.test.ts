import { describe, expect, it, vi } from 'vitest';
import type { Content } from '../domain/content.js';
import type { MediaAsset } from '../domain/media.js';
import type { MediaGenerator } from '../types/media-generation.js';
import type { MediaStorage } from '../types/media-storage.js';
import { ConflictError, MediaGenerationError, NotFoundError } from '../types/errors.js';
import { MediaService, type MediaRepository } from './media-service.js';
import type { ContentService } from './content-service.js';
import type { ProductService } from './product-service.js';

const user = { userId: 'user-1' };

const draftContent: Content = {
  id: 'c1',
  userId: 'user-1',
  title: 'Hook',
  body: 'Body',
  status: 'draft',
  contentType: 'video',
  metadata: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMocks(options?: { content?: Content }) {
  const content = options?.content ?? draftContent;

  const contentService = {
    getById: vi.fn(async () => content),
  } as unknown as ContentService;

  const productService = {
    getById: vi.fn(async () => ({
      id: 'p1',
      title: 'Widget',
      images: ['https://example.com/w.jpg'],
    })),
  } as unknown as ProductService;

  const assets = new Map<string, MediaAsset>();

  const mediaRepository: MediaRepository = {
    async create(input) {
      const row: MediaAsset = { ...input, createdAt: new Date() };
      assets.set(row.id, row);
      return row;
    },
    async findById(id) {
      return assets.get(id) ?? null;
    },
    async findByContentId(contentId) {
      return [...assets.values()].filter((a) => a.contentId === contentId);
    },
  };

  const mediaStorage: MediaStorage = {
    put: vi.fn(async (input) => ({ key: input.key, size: input.body.byteLength })),
    get: vi.fn(),
    delete: vi.fn(),
  };

  const mediaGenerator: MediaGenerator = {
    generate: vi.fn(async () => ({
      body: new TextEncoder().encode('<svg></svg>').buffer,
      mimeType: 'image/svg+xml',
      mediaType: 'image' as const,
      metadata: { generator: 'test' },
    })),
  };

  return { contentService, productService, mediaRepository, mediaStorage, mediaGenerator, assets };
}

describe('MediaService', () => {
  it('generates media for draft content and stores metadata + binary', async () => {
    const mocks = createMocks();
    const service = new MediaService(
      mocks.contentService,
      mocks.productService,
      mocks.mediaRepository,
      mocks.mediaStorage,
      mocks.mediaGenerator,
      'test-bucket',
    );

    const asset = await service.generateForContent(user, 'c1', { productId: 'p1' });

    expect(asset.contentId).toBe('c1');
    expect(asset.bucket).toBe('test-bucket');
    expect(asset.mimeType).toBe('image/svg+xml');
    expect(mocks.mediaStorage.put).toHaveBeenCalledOnce();
    expect(asset.key).toContain('media/user-1/c1/');
    expect(asset.metadata.productId).toBe('p1');
  });

  it('lists and gets media scoped to content owner', async () => {
    const mocks = createMocks();
    const service = new MediaService(
      mocks.contentService,
      mocks.productService,
      mocks.mediaRepository,
      mocks.mediaStorage,
      mocks.mediaGenerator,
      'test-bucket',
    );
    const created = await service.generateForContent(user, 'c1');
    const listed = await service.listForContent(user, 'c1');
    expect(listed).toHaveLength(1);
    const fetched = await service.getForContent(user, 'c1', created.id);
    expect(fetched.id).toBe(created.id);
  });

  it('rejects media generation for cancelled content', async () => {
    const mocks = createMocks({
      content: { ...draftContent, status: 'cancelled' },
    });
    const service = new MediaService(
      mocks.contentService,
      mocks.productService,
      mocks.mediaRepository,
      mocks.mediaStorage,
      mocks.mediaGenerator,
      'test-bucket',
    );

    await expect(service.generateForContent(user, 'c1')).rejects.toBeInstanceOf(ConflictError);
    expect(mocks.mediaStorage.put).not.toHaveBeenCalled();
  });

  it('propagates generator failures without persisting', async () => {
    const mocks = createMocks();
    mocks.mediaGenerator.generate = vi.fn(async () => {
      throw new MediaGenerationError('AI failed', 'generation');
    });
    const service = new MediaService(
      mocks.contentService,
      mocks.productService,
      mocks.mediaRepository,
      mocks.mediaStorage,
      mocks.mediaGenerator,
      'test-bucket',
    );

    await expect(service.generateForContent(user, 'c1')).rejects.toBeInstanceOf(MediaGenerationError);
    expect(mocks.mediaStorage.put).not.toHaveBeenCalled();
  });

  it('returns not found for media outside content', async () => {
    const mocks = createMocks();
    const service = new MediaService(
      mocks.contentService,
      mocks.productService,
      mocks.mediaRepository,
      mocks.mediaStorage,
      mocks.mediaGenerator,
      'test-bucket',
    );
    await expect(service.getForContent(user, 'c1', 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
