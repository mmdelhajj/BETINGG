import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  vipTier: string;
  iat?: number;
  exp?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

function extractToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
  return {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    vipTier: decoded.vipTier,
  };
}

/**
 * Required authentication middleware.
 * Rejects the request with 401 if no valid token is present.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = extractToken(request);

  if (!token) {
    void reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please provide a valid Bearer token.',
      },
    });
    return;
  }

  try {
    request.user = verifyToken(token);
  } catch (err) {
    const message =
      err instanceof jwt.TokenExpiredError
        ? 'Token has expired. Please refresh your token.'
        : err instanceof jwt.JsonWebTokenError
          ? 'Invalid token. Please provide a valid Bearer token.'
          : 'Authentication failed.';

    void reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message,
      },
    });
  }
}

/**
 * Optional authentication middleware.
 * Attaches user to request if a valid token is present, but continues regardless.
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const token = extractToken(request);

  if (!token) {
    return;
  }

  try {
    request.user = verifyToken(token);
  } catch {
    // Token is invalid but auth is optional - continue without user
  }
}

/**
 * Admin guard middleware. Must be used AFTER authenticate.
 * Rejects with 403 if user is not ADMIN or SUPER_ADMIN.
 */
export async function adminGuard(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.user) {
    void reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      },
    });
    return;
  }

  const allowedRoles = ['ADMIN', 'SUPER_ADMIN'];

  if (!allowedRoles.includes(request.user.role)) {
    void reply.status(403).send({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied. Administrator privileges required.',
      },
    });
  }
}

export default { authenticate, optionalAuth, adminGuard };
