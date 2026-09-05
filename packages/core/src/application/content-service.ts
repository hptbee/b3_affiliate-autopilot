import type { Content, ContentStatus, ContentType } from '../domain/content.js';
import { canTransitionContentStatus } from '../domain/content.js';
import { ConflictError, NotFoundError, ValidationError } from '../types/errors.js';

export interface CreateContentInput {
  userId: string;
  title: string;
  body: string;
  contentType?: ContentType;
}

export interface UpdateContentInput {
  title?: string;
  body?: string;
  status?: ContentStatus;
  contentType?: ContentType;
}

export interface ContentRepository {
  create(input: CreateContentInput): Promise<Content>;
  findById(id: string): Promise<Content | null>;
  findByUserId(userId: string): Promise<Content[]>;
  update(id: string, input: UpdateContentInput): Promise<Content>;
  delete(id: string): Promise<void>;
}

export class ContentService {
  constructor(private readonly repository: ContentRepository) {}

  async create(input: CreateContentInput): Promise<Content> {
    if (!input.title.trim()) {
      throw new ValidationError('Title is required');
    }
    if (!input.body.trim()) {
      throw new ValidationError('Body is required');
    }

    return this.repository.create({
      ...input,
      contentType: input.contentType ?? 'text',
    });
  }

  async getById(id: string): Promise<Content> {
    const content = await this.repository.findById(id);
    if (!content) {
      throw new NotFoundError('Content', id);
    }
    return content;
  }

  async listByUser(userId: string): Promise<Content[]> {
    return this.repository.findByUserId(userId);
  }

  async update(id: string, input: UpdateContentInput): Promise<Content> {
    const existing = await this.getById(id);

    if (input.status && input.status !== existing.status) {
      if (!canTransitionContentStatus(existing.status, input.status)) {
        throw new ConflictError(
          `Cannot transition content from ${existing.status} to ${input.status}`,
        );
      }
    }

    return this.repository.update(id, input);
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.repository.delete(id);
  }
}
