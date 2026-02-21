import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ZodSchema, ZodError } from 'zod';

/**
 * Creates a Fastify preHandler hook that validates request.body against a Zod schema.
 * On validation failure, responds with a 400 error containing formatted field errors.
 *
 * @param schema - A Zod schema to validate request.body against
 * @returns A preHandler hook function
 *
 * @example
 * ```ts
 * const createUserSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
 * fastify.post('/users', { preHandler: [validate(createUserSchema)] }, handler);
 * ```
 */
export function validate<T>(schema: ZodSchema<T>) {
  return async function validationHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      const zodError: ZodError = result.error;
      const fieldErrors: Record<string, string[]> = {};

      for (const issue of zodError.issues) {
        const path = issue.path.join('.');
        const key = path || '_root';
        if (!fieldErrors[key]) {
          fieldErrors[key] = [];
        }
        fieldErrors[key].push(issue.message);
      }

      request.log.warn({ url: request.url, body: request.body, fieldErrors }, 'VALIDATION_ERROR');

      void reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: fieldErrors,
        },
      });
      return;
    }

    // Replace the body with the parsed (and potentially transformed) data
    (request.body as T) = result.data;
  };
}

/**
 * Creates a Fastify preHandler hook that validates request.params against a Zod schema.
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return async function paramsValidationHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const result = schema.safeParse(request.params);

    if (!result.success) {
      const zodError: ZodError = result.error;
      const fieldErrors: Record<string, string[]> = {};

      for (const issue of zodError.issues) {
        const path = issue.path.join('.');
        const key = path || '_root';
        if (!fieldErrors[key]) {
          fieldErrors[key] = [];
        }
        fieldErrors[key].push(issue.message);
      }

      void reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Path parameter validation failed',
          details: fieldErrors,
        },
      });
      return;
    }

    (request.params as T) = result.data;
  };
}

/**
 * Creates a Fastify preHandler hook that validates request.query against a Zod schema.
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return async function queryValidationHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const result = schema.safeParse(request.query);

    if (!result.success) {
      const zodError: ZodError = result.error;
      const fieldErrors: Record<string, string[]> = {};

      for (const issue of zodError.issues) {
        const path = issue.path.join('.');
        const key = path || '_root';
        if (!fieldErrors[key]) {
          fieldErrors[key] = [];
        }
        fieldErrors[key].push(issue.message);
      }

      void reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query parameter validation failed',
          details: fieldErrors,
        },
      });
      return;
    }

    (request.query as T) = result.data;
  };
}

export default validate;
