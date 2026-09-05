export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'AI_PROVIDER_ERROR'
  | 'SOCIAL_PUBLISH_ERROR'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super('NOT_FOUND', `${entity} not found: ${id}`, 404, { entity, id });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, 409, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super('AUTHENTICATION_ERROR', message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Forbidden') {
    super('AUTHORIZATION_ERROR', message, 403);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('EXTERNAL_SERVICE_ERROR', message, 502, details);
  }
}

export class AIProviderError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('AI_PROVIDER_ERROR', message, 502, details);
  }
}

export class SocialPublishError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('SOCIAL_PUBLISH_ERROR', message, 502, details);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
