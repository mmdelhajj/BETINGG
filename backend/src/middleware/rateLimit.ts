import type { FastifyReply, FastifyRequest } from 'fastify';
import { redis } from '../lib/redis.js';

/**
 * Creates a custom Redis-backed rate limiter preHandler hook.
 *
 * Uses the Redis INCR + EXPIRE pattern for atomic rate limiting.
 * Each unique client (identified by IP) gets a counter per prefix
 * that expires after the specified window.
 *
 * @param prefix - A unique prefix for the rate limit key (e.g., 'login', 'api')
 * @param max - Maximum number of requests allowed in the window
 * @param windowSec - Time window in seconds
 * @returns A Fastify preHandler hook
 *
 * @example
 * ```ts
 * // Allow 5 login attempts per 60 seconds
 * fastify.post('/login', { preHandler: [createRateLimiter('login', 5, 60)] }, handler);
 * ```
 */
export function createRateLimiter(prefix: string, max: number, windowSec: number) {
  return async function rateLimitHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const identifier = request.ip;
    const key = `ratelimit:${prefix}:${identifier}`;

    try {
      const current = await redis.incr(key);

      // If this is the first request in the window, set the expiry
      if (current === 1) {
        await redis.expire(key, windowSec);
      }

      // Get the TTL so we can include it in the response headers
      const ttl = await redis.ttl(key);
      const remaining = Math.max(0, max - current);
      const resetTime = Math.ceil(Date.now() / 1000) + Math.max(0, ttl);

      // Set rate limit headers
      void reply.header('X-RateLimit-Limit', max.toString());
      void reply.header('X-RateLimit-Remaining', remaining.toString());
      void reply.header('X-RateLimit-Reset', resetTime.toString());

      if (current > max) {
        void reply.header('Retry-After', Math.max(0, ttl).toString());
        void reply.status(429).send({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. Please try again in ${Math.max(0, ttl)} seconds.`,
            details: {
              limit: max,
              windowSeconds: windowSec,
              retryAfter: Math.max(0, ttl),
            },
          },
        });
      }
    } catch (err) {
      // If Redis is unavailable, log the error but allow the request through
      // to avoid blocking all traffic due to Redis issues
      request.log.error({ err, prefix, key }, 'Rate limiter Redis error - allowing request');
    }
  };
}

/**
 * Creates a rate limiter keyed by user ID instead of IP.
 * Must be used after authentication middleware.
 */
export function createUserRateLimiter(prefix: string, max: number, windowSec: number) {
  return async function userRateLimitHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const userId = request.user?.id;
    if (!userId) {
      // If no user is authenticated, fall back to IP-based limiting
      const identifier = request.ip;
      const key = `ratelimit:${prefix}:ip:${identifier}`;

      try {
        const current = await redis.incr(key);
        if (current === 1) {
          await redis.expire(key, windowSec);
        }
        if (current > max) {
          const ttl = await redis.ttl(key);
          void reply.header('Retry-After', Math.max(0, ttl).toString());
          void reply.status(429).send({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: `Too many requests. Please try again in ${Math.max(0, ttl)} seconds.`,
            },
          });
        }
      } catch (err) {
        request.log.error({ err, prefix, key }, 'Rate limiter Redis error - allowing request');
      }
      return;
    }

    const key = `ratelimit:${prefix}:user:${userId}`;

    try {
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, windowSec);
      }

      const ttl = await redis.ttl(key);
      const remaining = Math.max(0, max - current);
      const resetTime = Math.ceil(Date.now() / 1000) + Math.max(0, ttl);

      void reply.header('X-RateLimit-Limit', max.toString());
      void reply.header('X-RateLimit-Remaining', remaining.toString());
      void reply.header('X-RateLimit-Reset', resetTime.toString());

      if (current > max) {
        void reply.header('Retry-After', Math.max(0, ttl).toString());
        void reply.status(429).send({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. Please try again in ${Math.max(0, ttl)} seconds.`,
            details: {
              limit: max,
              windowSeconds: windowSec,
              retryAfter: Math.max(0, ttl),
            },
          },
        });
      }
    } catch (err) {
      request.log.error({ err, prefix, key }, 'Rate limiter Redis error - allowing request');
    }
  };
}

export default createRateLimiter;
