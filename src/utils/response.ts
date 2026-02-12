import { FastifyReply } from 'fastify';

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    total?: number;
    hasMore?: boolean;
    cursor?: string;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function sendSuccess<T>(reply: FastifyReply, data: T, meta?: SuccessResponse['meta'], statusCode = 200): void {
  const response: SuccessResponse<T> = { success: true, data };
  if (meta) response.meta = meta;
  reply.status(statusCode).send(response);
}

export function sendError(
  reply: FastifyReply,
  code: string,
  message: string,
  statusCode = 400,
  details?: unknown
): void {
  const response: ErrorResponse = {
    success: false,
    error: { code, message },
  };
  if (details) response.error.details = details;
  reply.status(statusCode).send(response);
}

export function sendCreated<T>(reply: FastifyReply, data: T): void {
  sendSuccess(reply, data, undefined, 201);
}

export function sendNoContent(reply: FastifyReply): void {
  reply.status(204).send();
}
