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

// ---------------------------------------------------------------------------
// In-memory JWT token cache
// ---------------------------------------------------------------------------

interface CachedToken {
  payload: JwtPayload;
  expiresAt: number; // epoch ms when this cache entry expires
}

const tokenCache = new Map<string, CachedToken>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Periodically remove expired entries from the token cache.
 * Runs every 5 minutes.
 */
const cacheCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of tokenCache) {
    if (entry.expiresAt <= now) {
      tokenCache.delete(key);
    }
  }
}, CACHE_TTL_MS);

// Allow the process to exit cleanly without this interval keeping it alive
if (cacheCleanupInterval.unref) {
  cacheCleanupInterval.unref();
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

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
  // Check cache first
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  // Cache miss or expired — verify with jsonwebtoken
  const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
  const payload: JwtPayload = {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    vipTier: decoded.vipTier,
  };

  // Cache for the shorter of 5 minutes or time until token expiry
  const now = Date.now();
  const tokenExpiryMs = decoded.exp ? decoded.exp * 1000 : now + CACHE_TTL_MS;
  const cacheExpiresAt = Math.min(now + CACHE_TTL_MS, tokenExpiryMs);

  // Only cache if it would last at least 10 seconds
  if (cacheExpiresAt - now > 10_000) {
    tokenCache.set(token, { payload, expiresAt: cacheExpiresAt });
  }

  return payload;
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
