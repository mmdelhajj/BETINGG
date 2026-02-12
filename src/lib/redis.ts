import Redis from 'ioredis';
import { redisConfig, redisPubSubConfig } from '../config/redis';

export const redis = new Redis(redisConfig);
export const redisPub = new Redis(redisPubSubConfig);
export const redisSub = new Redis(redisPubSubConfig);

redis.on('error', (err) => {
  console.error('Redis client error:', err.message);
});

redis.on('connect', () => {
  console.log('Redis client connected');
});

export async function getCache<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  if (!data) return null;
  return JSON.parse(data) as T;
}

export async function setCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function deleteCache(key: string): Promise<void> {
  await redis.del(key);
}

export async function deleteCachePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

export default redis;
