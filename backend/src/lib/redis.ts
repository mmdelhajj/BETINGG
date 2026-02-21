import Redis from 'ioredis';
import { config } from '../config/index.js';

/**
 * Shared Redis client for caching, pub/sub, and general key-value operations.
 *
 * BullMQ requires its own connections (one per worker/queue), so use
 * `createRedisConnection()` when instantiating queues or workers.
 */
export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy(times: number): number | null {
    if (times > 20) {
      console.error(`[Redis] Exhausted ${times} reconnection attempts. Giving up.`);
      return null; // stop retrying
    }
    const delay = Math.min(times * 100, 5000);
    console.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${times})...`);
    return delay;
  },
  reconnectOnError(err: Error): boolean | 1 | 2 {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    if (targetErrors.some((e) => err.message.includes(e))) {
      return 2; // reconnect and re-send the failed command
    }
    return false;
  },
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

redis.on('ready', () => {
  console.log('[Redis] Ready to accept commands');
});

redis.on('error', (err: Error) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('close', () => {
  console.warn('[Redis] Connection closed');
});

redis.on('reconnecting', () => {
  console.warn('[Redis] Reconnecting...');
});

/**
 * Create a new isolated Redis connection.
 * Use this for BullMQ queues and workers which require dedicated connections.
 */
export function createRedisConnection(): Redis {
  return new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times: number): number | null {
      if (times > 20) {
        return null;
      }
      return Math.min(times * 100, 5000);
    },
    reconnectOnError(err: Error): boolean | 1 | 2 {
      if (err.message.includes('READONLY')) {
        return 2;
      }
      return false;
    },
  });
}

/**
 * Gracefully close the shared Redis connection on shutdown.
 */
async function shutdown(): Promise<void> {
  console.log('[Redis] Disconnecting...');
  await redis.quit();
  console.log('[Redis] Disconnected.');
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default redis;
