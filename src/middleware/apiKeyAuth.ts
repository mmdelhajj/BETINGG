import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';

export interface ApiKeyPayload {
  userId: string;
  permissions: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    apiKeyUser?: ApiKeyPayload;
  }
}

export async function apiKeyMiddleware(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string;
  if (!apiKey) {
    throw new UnauthorizedError('API key required');
  }

  const keyRecord = await prisma.apiKey.findUnique({
    where: { key: apiKey },
    include: { user: { select: { id: true, isActive: true, isBanned: true } } },
  });

  if (!keyRecord || !keyRecord.isActive) {
    throw new UnauthorizedError('Invalid or inactive API key');
  }

  if (!keyRecord.user.isActive || keyRecord.user.isBanned) {
    throw new ForbiddenError('Account is inactive or banned');
  }

  await prisma.apiKey.update({
    where: { id: keyRecord.id },
    data: { lastUsedAt: new Date() },
  });

  request.apiKeyUser = {
    userId: keyRecord.userId,
    permissions: keyRecord.permissions as string[],
  };
}

export function requirePermission(permission: string) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.apiKeyUser) {
      throw new UnauthorizedError('API key authentication required');
    }
    if (!request.apiKeyUser.permissions.includes(permission)) {
      throw new ForbiddenError(`Missing permission: ${permission}`);
    }
  };
}
