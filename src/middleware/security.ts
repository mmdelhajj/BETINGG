import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../lib/redis';

// ─── OWASP Security Headers ────────────────────────────────
export async function securityHeaders(app: FastifyInstance) {
  app.addHook('onSend', async (_req, reply) => {
    // Content Security Policy
    reply.header('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' wss: ws: https:",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '));

    // Prevent clickjacking
    reply.header('X-Frame-Options', 'SAMEORIGIN');

    // Prevent MIME type sniffing
    reply.header('X-Content-Type-Options', 'nosniff');

    // XSS Protection (legacy browsers)
    reply.header('X-XSS-Protection', '1; mode=block');

    // Referrer Policy
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy (disable unnecessary browser features)
    reply.header('Permissions-Policy', [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=(self)',
    ].join(', '));

    // HSTS (only in production)
    if (process.env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
  });
}

// ─── Rate Limiter (Redis-backed) ───────────────────────────
interface RateLimitConfig {
  windowMs: number;    // Window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix: string;   // Redis key prefix
}

export function createRateLimiter(config: RateLimitConfig) {
  return async function rateLimiter(req: FastifyRequest, reply: FastifyReply) {
    const ip = req.ip;
    const userId = (req as any).userId;
    const key = `${config.keyPrefix}:${userId || ip}`;

    const multi = redis.multi();
    multi.incr(key);
    multi.pttl(key);
    const results = await multi.exec();

    const count = (results?.[0]?.[1] as number) || 0;
    const ttl = (results?.[1]?.[1] as number) || -1;

    // Set TTL on first request
    if (ttl === -1 || ttl === -2) {
      await redis.pexpire(key, config.windowMs);
    }

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', config.maxRequests);
    reply.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - count));
    reply.header('X-RateLimit-Reset', Math.ceil((Date.now() + (ttl > 0 ? ttl : config.windowMs)) / 1000));

    if (count > config.maxRequests) {
      reply.header('Retry-After', Math.ceil((ttl > 0 ? ttl : config.windowMs) / 1000));
      reply.code(429).send({
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' },
      });
    }
  };
}

// Pre-configured rate limiters
export const feedRateLimit = createRateLimiter({ windowMs: 1000, maxRequests: 10, keyPrefix: 'rl:feed' });
export const tradingRateLimit = createRateLimiter({ windowMs: 1000, maxRequests: 1, keyPrefix: 'rl:trade' });
export const authRateLimit = createRateLimiter({ windowMs: 60000, maxRequests: 5, keyPrefix: 'rl:auth' });
export const generalRateLimit = createRateLimiter({ windowMs: 60000, maxRequests: 100, keyPrefix: 'rl:gen' });

// ─── Input Sanitization ────────────────────────────────────
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Strip HTML angle brackets
    .replace(/javascript:/gi, '') // Strip javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Strip inline event handlers
    .replace(/\x00/g, '') // Strip null bytes
    .trim();
}

export function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') return sanitizeInput(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeInput(key)] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
}

// ─── SQL Injection Prevention (for raw queries) ────────────
export function escapeSqlLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

// ─── CSRF Token ────────────────────────────────────────────
export async function generateCsrfToken(sessionId: string): Promise<string> {
  const crypto = await import('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  await redis.setex(`csrf:${sessionId}`, 3600, token);
  return token;
}

export async function verifyCsrfToken(sessionId: string, token: string): Promise<boolean> {
  const stored = await redis.get(`csrf:${sessionId}`);
  return stored === token;
}

// ─── Brute Force Protection ────────────────────────────────
const LOGIN_ATTEMPT_PREFIX = 'login_attempts:';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 900; // 15 minutes

export async function checkLoginAttempts(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
  const key = `${LOGIN_ATTEMPT_PREFIX}${identifier}`;
  const attempts = await redis.get(key);
  const count = parseInt(attempts || '0', 10);

  return {
    allowed: count < MAX_LOGIN_ATTEMPTS,
    remaining: Math.max(0, MAX_LOGIN_ATTEMPTS - count),
  };
}

export async function recordLoginAttempt(identifier: string, success: boolean): Promise<void> {
  const key = `${LOGIN_ATTEMPT_PREFIX}${identifier}`;

  if (success) {
    await redis.del(key);
  } else {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, LOCKOUT_DURATION);
    }
  }
}

// ─── Request Size Limiter ──────────────────────────────────
export async function requestSizeLimiter(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (contentLength > maxSize) {
      reply.code(413).send({
        success: false,
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds maximum size' },
      });
    }
  });
}
