"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const index_js_1 = require("../config/index.js");
const globalForPrisma = globalThis;
function createPrismaClient() {
    const client = new client_1.PrismaClient({
        datasourceUrl: index_js_1.config.DATABASE_URL,
        log: index_js_1.config.NODE_ENV === 'development'
            ? [
                { emit: 'stdout', level: 'query' },
                { emit: 'stdout', level: 'info' },
                { emit: 'stdout', level: 'warn' },
                { emit: 'stdout', level: 'error' },
            ]
            : index_js_1.config.NODE_ENV === 'test'
                ? [{ emit: 'stdout', level: 'error' }]
                : [
                    { emit: 'stdout', level: 'warn' },
                    { emit: 'stdout', level: 'error' },
                ],
    });
    client.$connect().catch((err) => {
        console.error('[Prisma] Failed to connect to database:', err);
        process.exit(1);
    });
    return client;
}
/**
 * Singleton PrismaClient instance.
 *
 * In development, the client is stored on globalThis to survive hot-reloads
 * via tsx watch without creating multiple database connections.
 * In production, a single instance is created and reused.
 */
exports.prisma = globalForPrisma.prisma ?? createPrismaClient();
if (index_js_1.config.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}
/**
 * Gracefully disconnect Prisma when the process shuts down.
 */
async function shutdown() {
    console.log('[Prisma] Disconnecting client...');
    await exports.prisma.$disconnect();
    console.log('[Prisma] Disconnected.');
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
exports.default = exports.prisma;
