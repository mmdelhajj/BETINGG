import pino from 'pino';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.NODE_ENV === 'development' ? 'debug' : 'info',
  transport:
    config.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
  base: {
    service: 'cryptobet-api',
    env: config.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req(request: FastifyRequest) {
      return {
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      };
    },
    res(reply: FastifyReply) {
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
export async function requestLogger(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
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
    logger.error(logData, 'Request completed with server error');
  } else if (reply.statusCode >= 400) {
    logger.warn(logData, 'Request completed with client error');
  } else {
    logger.info(logData, 'Request completed');
  }
}

export default logger;
