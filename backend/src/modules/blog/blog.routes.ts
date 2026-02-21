import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateQuery } from '../../middleware/validate.js';
import { validateParams } from '../../middleware/validate.js';
import {
  listPostsQuerySchema,
  slugParamSchema,
  type ListPostsQuery,
  type SlugParam,
} from './blog.schemas.js';
import * as blogService from './blog.service.js';

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

export default async function blogRoutes(fastify: FastifyInstance): Promise<void> {
  // =======================================================================
  // PUBLIC ROUTES
  // =======================================================================

  // GET /api/v1/blog/posts — list published posts (page, limit, category?)
  fastify.get(
    '/api/v1/blog/posts',
    { preHandler: [validateQuery(listPostsQuerySchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as ListPostsQuery;
        const result = await blogService.getPosts(query);
        return success(reply, result);
      } catch (err) {
        if (err instanceof blogService.BlogError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // GET /api/v1/blog/posts/:slug — get single post by slug
  fastify.get(
    '/api/v1/blog/posts/:slug',
    { preHandler: [validateParams(slugParamSchema)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { slug } = request.params as SlugParam;
        const [post, related] = await Promise.all([
          blogService.getPost(slug),
          blogService.getRelatedPosts(slug),
        ]);
        return success(reply, { post, related });
      } catch (err) {
        if (err instanceof blogService.BlogError) {
          return error(reply, err.code, err.message, err.statusCode);
        }
        throw err;
      }
    },
  );

  // GET /api/v1/blog/categories — list categories
  fastify.get(
    '/api/v1/blog/categories',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const categories = await blogService.getCategories();
        return success(reply, { categories });
      } catch (err) {
        throw err;
      }
    },
  );

}
