export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(code: string, message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super('NOT_FOUND', `${resource}${id ? ` with id ${id}` : ''} not found`, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super('FORBIDDEN', message, 403);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}

export class InsufficientBalanceError extends AppError {
  constructor() {
    super('INSUFFICIENT_BALANCE', 'Insufficient balance for this operation', 400);
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super('RATE_LIMIT', 'Too many requests. Please try again later.', 429);
  }
}

export class GeoRestrictedError extends AppError {
  constructor(country: string) {
    super('GEO_RESTRICTED', `Service not available in ${country}`, 403);
  }
}
