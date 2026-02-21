import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import pino from 'pino';
import { config } from '../config/index.js';

const log = pino({
  level: config.NODE_ENV === 'development' ? 'debug' : 'info',
  transport:
    config.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function formatZodError(error: ZodError): ErrorResponse {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    const key = path || '_root';
    if (!fieldErrors[key]) {
      fieldErrors[key] = [];
    }
    fieldErrors[key].push(issue.message);
  }

  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: fieldErrors,
    },
  };
}

function formatPrismaError(error: Prisma.PrismaClientKnownRequestError): ErrorResponse {
  switch (error.code) {
    case 'P2002': {
      const target = (error.meta?.target as string[]) ?? ['field'];
      return {
        success: false,
        error: {
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: `A record with this ${target.join(', ')} already exists`,
          details: { fields: target },
        },
      };
    }
    case 'P2025':
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested record was not found',
        },
      };
    case 'P2003': {
      const fieldName = (error.meta?.field_name as string) ?? 'field';
      return {
        success: false,
        error: {
          code: 'FOREIGN_KEY_CONSTRAINT',
          message: `Related record not found for ${fieldName}`,
          details: { field: fieldName },
        },
      };
    }
    case 'P2014':
      return {
        success: false,
        error: {
          code: 'RELATION_VIOLATION',
          message: 'The change would violate a required relation',
        },
      };
    default:
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: config.NODE_ENV === 'production'
            ? 'A database error occurred'
            : `Prisma error ${error.code}: ${error.message}`,
        },
      };
  }
}

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  log.error(
    {
      err: error,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    },
    'Request error',
  );

  // Zod validation errors
  if (error instanceof ZodError) {
    const formatted = formatZodError(error);
    void reply.status(400).send(formatted);
    return;
  }

  // Prisma known request errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const formatted = formatPrismaError(error);
    const statusCode = error.code === 'P2025' ? 404 : 409;
    void reply.status(statusCode).send(formatted);
    return;
  }

  // Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    void reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: config.NODE_ENV === 'production'
          ? 'Invalid data provided'
          : error.message,
      },
    } satisfies ErrorResponse);
    return;
  }

  // Fastify errors (rate limit, not found, etc.)
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    const fastifyError = error as FastifyError;
    void reply.status(fastifyError.statusCode ?? 500).send({
      success: false,
      error: {
        code: fastifyError.code ?? 'REQUEST_ERROR',
        message: fastifyError.message,
      },
    } satisfies ErrorResponse);
    return;
  }

  // Unknown errors - don't leak internals in production
  void reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: config.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message || 'An unexpected error occurred',
    },
  } satisfies ErrorResponse);
}

export default errorHandler;
