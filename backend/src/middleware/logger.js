"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.requestLogger = requestLogger;
const pino_1 = __importDefault(require("pino"));
const index_js_1 = require("../config/index.js");
exports.logger = (0, pino_1.default)({
    level: index_js_1.config.NODE_ENV === 'development' ? 'debug' : 'info',
    transport: index_js_1.config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
        : undefined,
    base: {
        service: 'cryptobet-api',
        env: index_js_1.config.NODE_ENV,
    },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
    serializers: {
        req(request) {
            return {
                method: request.method,
                url: request.url,
                ip: request.ip,
                userAgent: request.headers['user-agent'],
            };
        },
        res(reply) {
            return {
                statusCode: reply.statusCode,
            };
        },
    },
});
/**
 * Request logging hook.
 * Attach as onResponse hook to log completed requests with timing info.
 */
async function requestLogger(request, reply) {
    const responseTime = reply.elapsedTime;
    const logData = {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: `${responseTime.toFixed(2)}ms`,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
    };
    if (reply.statusCode >= 500) {
        exports.logger.error(logData, 'Request completed with server error');
    }
    else if (reply.statusCode >= 400) {
        exports.logger.warn(logData, 'Request completed with client error');
    }
    else {
        exports.logger.info(logData, 'Request completed');
    }
}
exports.default = exports.logger;
