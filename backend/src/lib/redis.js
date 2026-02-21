"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.createRedisConnection = createRedisConnection;
const ioredis_1 = __importDefault(require("ioredis"));
const index_js_1 = require("../config/index.js");
/**
 * Shared Redis client for caching, pub/sub, and general key-value operations.
 *
 * BullMQ requires its own connections (one per worker/queue), so use
 * `createRedisConnection()` when instantiating queues or workers.
 */
exports.redis = new ioredis_1.default(index_js_1.config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy(times) {
        if (times > 20) {
            console.error(`[Redis] Exhausted ${times} reconnection attempts. Giving up.`);
            return null; // stop retrying
        }
        const delay = Math.min(times * 100, 5000);
        console.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${times})...`);
        return delay;
    },
    reconnectOnError(err) {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        if (targetErrors.some((e) => err.message.includes(e))) {
            return 2; // reconnect and re-send the failed command
        }
        return false;
    },
});
exports.redis.on('connect', () => {
    console.log('[Redis] Connected successfully');
});
exports.redis.on('ready', () => {
    console.log('[Redis] Ready to accept commands');
});
exports.redis.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
});
exports.redis.on('close', () => {
    console.warn('[Redis] Connection closed');
});
exports.redis.on('reconnecting', () => {
    console.warn('[Redis] Reconnecting...');
});
/**
 * Create a new isolated Redis connection.
 * Use this for BullMQ queues and workers which require dedicated connections.
 */
function createRedisConnection() {
    return new ioredis_1.default(index_js_1.config.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        retryStrategy(times) {
            if (times > 20) {
                return null;
            }
            return Math.min(times * 100, 5000);
        },
        reconnectOnError(err) {
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
async function shutdown() {
    console.log('[Redis] Disconnecting...');
    await exports.redis.quit();
    console.log('[Redis] Disconnected.');
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
exports.default = exports.redis;
