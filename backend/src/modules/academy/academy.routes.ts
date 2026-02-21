import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { optionalAuth } from '../../middleware/auth.js';
import { validate, validateParams } from '../../middleware/validate.js';
import {
  idParamSchema,
  lessonParamSchema,
  markCompleteSchema,
  type IdParam,
  type LessonParam,
  type MarkCompleteInput,
} from './academy.schemas.js';
import * as academyService from './academy.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function success(reply: FastifyReply, data: unknown, statusCode = 200) {
  return reply.status(statusCode).send({ success: true, data });
}

function error(reply: FastifyReply, code: string, message: string, statusCode = 400) {
  return reply.status(statusCode).send({
    success: false,
    error: { code, message },
  });
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function academyRoutes(fastify: FastifyInstance): Promise<void> {
  // =======================================================================
  // PUBLIC ROUTES
  // =======================================================================

  // GET /api/v1/academy/courses — list published courses
  fastify.get(
    '/api/v1/academy/courses',
    { preHandler: [optionalAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const courses = await academyService.getCourses(request.user?.id);
        return success(reply, { courses });
      } catch (err) {
        if (err instanceof academyService.AcademyError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // GET /api/v1/academy/courses/:id — course detail with lessons
  fastify.get(
    '/api/v1/academy/courses/:id',
    { preHandler: [optionalAuth, validateParams(idParamSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as IdParam;
        const course = await academyService.getCourse(id, request.user?.id);
        return success(reply, { course });
      } catch (err) {
        if (err instanceof academyService.AcademyError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // GET /api/v1/academy/courses/:id/lessons/:lessonId — lesson content
  fastify.get(
    '/api/v1/academy/courses/:id/lessons/:lessonId',
    { preHandler: [validateParams(lessonParamSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, lessonId } = request.params as LessonParam;
        const result = await academyService.getLesson(id, lessonId);
        return success(reply, result);
      } catch (err) {
        if (err instanceof academyService.AcademyError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // POST /api/v1/academy/progress — mark lesson as complete (authenticated)
  fastify.post(
    '/api/v1/academy/progress',
    { preHandler: [authenticate, validate(markCompleteSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { courseId, lessonId } = request.body as MarkCompleteInput;
        const result = await academyService.markComplete(
          request.user!.id,
          courseId,
          lessonId,
        );
        return success(reply, result);
      } catch (err) {
        if (err instanceof academyService.AcademyError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // GET /api/v1/academy/progress — get user's course progress
  fastify.get(
    '/api/v1/academy/progress',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const progress = await academyService.getUserProgress(request.user!.id);
        return success(reply, { progress });
      } catch (err) {
        if (err instanceof academyService.AcademyError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

}
