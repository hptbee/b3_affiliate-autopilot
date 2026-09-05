import type { Content, ContentStatus, ContentType } from '../domain/content.js';
import { canTransitionContentStatus } from '../domain/content.js';
import type { UserContext } from '../types/user-context.js';
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from '../types/errors.js';

export interface CreateContentInput {
  title: string;
  body: string;
  contentType?: ContentType;
}

export interface UpdateContentInput {
  title?: string;
  body?: string;
  contentType?: ContentType;
}

export interface ContentRepository {
  create(input: CreateContentInput & { userId: string }): Promise<Content>;
  findById(id: string): Promise<Content | null>;
  findByUserId(userId: string): Promise<Content[]>;
  update(
    id: string,
    input: UpdateContentInput & { status?: ContentStatus },
  ): Promise<Content>;
  delete(id: string): Promise<void>;
}

export class ContentService {
  constructor(private readonly repository: ContentRepository) {}

  async create(user: UserContext, input: CreateContentInput): Promise<Content> {
    if (!input.title.trim()) {
      throw new ValidationError('Title is required');
    }
    if (!input.body.trim()) {
      throw new ValidationError('Body is required');
    }

    return this.repository.create({
      userId: user.userId,
      title: input.title,
      body: input.body,
      contentType: input.contentType ?? 'video',
    });
  }

  async getById(user: UserContext, id: string): Promise<Content> {
    const content = await this.repository.findById(id);
    if (!content || content.userId !== user.userId) {
      throw new NotFoundError('Content', id);
    }
    return content;
  }

  async listByUser(user: UserContext): Promise<Content[]> {
    return this.repository.findByUserId(user.userId);
  }

  async update(user: UserContext, id: string, input: UpdateContentInput): Promise<Content> {
    const existing = await this.getById(user, id);

    if (existing.status !== 'draft') {
      throw new ConflictError('Only draft content can be updated');
    }

    return this.repository.update(id, input);
  }

  async approve(user: UserContext, id: string): Promise<Content> {
    const existing = await this.getById(user, id);
    this.assertTransition(existing.status, 'approved');
    return this.repository.update(id, { status: 'approved' });
  }

  async cancel(user: UserContext, id: string): Promise<Content> {
    const existing = await this.getById(user, id);
    this.assertTransition(existing.status, 'cancelled');
    return this.repository.update(id, { status: 'cancelled' });
  }

  async archive(user: UserContext, id: string): Promise<Content> {
    const existing = await this.getById(user, id);
    this.assertTransition(existing.status, 'archived');
    return this.repository.update(id, { status: 'archived' });
  }

  async delete(user: UserContext, id: string): Promise<void> {
    await this.getById(user, id);
    await this.repository.delete(id);
  }

  private assertTransition(from: ContentStatus, to: ContentStatus): void {
    if (!canTransitionContentStatus(from, to)) {
      throw new ConflictError(`Cannot transition content from ${from} to ${to}`);
    }
  }
}

export function assertSameUser(ownerId: string, user: UserContext): void {
  if (ownerId !== user.userId) {
    throw new AuthorizationError();
  }
}
