import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validate, validateQuery, validateParams } from '../../middleware/validate.js';
import {
  listArticlesQuerySchema,
  slugParamSchema,
  idParamSchema,
  helpfulVoteSchema,
  type ListArticlesQuery,
  type SlugParam,
  type IdParam,
  type HelpfulVoteInput,
} from './help.schemas.js';
import * as helpService from './help.service.js';

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

export default async function helpRoutes(fastify: FastifyInstance): Promise<void> {
  // =======================================================================
  // PUBLIC ROUTES
  // =======================================================================

  // GET /api/v1/help/articles — list published articles (category?, search?)
  fastify.get(
    '/api/v1/help/articles',
    { preHandler: [validateQuery(listArticlesQuerySchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as ListArticlesQuery;
        const result = await helpService.getArticles(query);
        return success(reply, result);
      } catch (err) {
        if (err instanceof helpService.HelpError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // GET /api/v1/help/articles/:slug — get article
  fastify.get(
    '/api/v1/help/articles/:slug',
    { preHandler: [validateParams(slugParamSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { slug } = request.params as SlugParam;
        const article = await helpService.getArticle(slug);
        return success(reply, { article });
      } catch (err) {
        if (err instanceof helpService.HelpError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // GET /api/v1/help/categories — list categories
  fastify.get(
    '/api/v1/help/categories',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const categories = await helpService.getCategories();
        return success(reply, { categories });
      } catch (err) {
        throw err;
      }
    },
  );

  // POST /api/v1/help/articles/:id/helpful — submit helpful vote (yes/no)
  fastify.post(
    '/api/v1/help/articles/:id/helpful',
    { preHandler: [validateParams(idParamSchema), validate(helpfulVoteSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = request.params as IdParam;
        const { isHelpful } = request.body as HelpfulVoteInput;
        const result = await helpService.voteHelpful(id, isHelpful);
        return success(reply, result);
      } catch (err) {
        if (err instanceof helpService.HelpError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

}
