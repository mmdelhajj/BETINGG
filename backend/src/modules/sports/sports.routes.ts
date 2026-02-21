import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, adminGuard } from '../../middleware/auth.js';
import { validate, validateParams, validateQuery } from '../../middleware/validate.js';
import {
  sportSlugParamsSchema,
  competitionIdParamsSchema,
  eventIdParamsSchema,
  sportIdParamsSchema,
  marketIdParamsSchema,
  selectionIdParamsSchema,
  eventsQuerySchema,
  searchEventsQuerySchema,
  competitionEventsQuerySchema,
  createSportSchema,
  updateSportSchema,
  createCompetitionSchema,
  updateCompetitionSchema,
  createEventSchema,
  updateEventSchema,
  createMarketSchema,
  updateMarketSchema,
  createSelectionSchema,
  updateSelectionSchema,
  settleMarketSchema,
  type SportSlugParams,
  type CompetitionIdParams,
  type EventIdParams,
  type SportIdParams,
  type MarketIdParams,
  type SelectionIdParams,
  type EventsQuery,
  type SearchEventsQuery,
  type CompetitionEventsQuery,
  type CreateSportInput,
  type UpdateSportInput,
  type CreateCompetitionInput,
  type UpdateCompetitionInput,
  type CreateEventInput,
  type UpdateEventInput,
  type CreateMarketInput,
  type UpdateMarketInput,
  type CreateSelectionInput,
  type UpdateSelectionInput,
  type SettleMarketInput,
} from './sports.schemas.js';
import * as sportsService from './sports.service.js';

export default async function sportsRoutes(fastify: FastifyInstance): Promise<void> {
  // =========================================================================
  // PUBLIC ROUTES
  // =========================================================================

  // ─── GET /api/v1/sports ─────────────────────────────────────────────────
  fastify.get(
    '/sports',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const sports = await sportsService.getSports();
      return reply.status(200).send({ success: true, data: { sports } });
    },
  );

  // ─── GET /api/v1/sports/popular-competitions ───────────────────────────
  // NOTE: Must be registered BEFORE /sports/:slug to avoid route collision
  fastify.get(
    '/sports/popular-competitions',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const competitions = await sportsService.getPopularCompetitions();
      return reply.status(200).send({ success: true, data: { competitions } });
    },
  );

  // ─── GET /api/v1/sports/:slug ───────────────────────────────────────────
  fastify.get(
    '/sports/:slug',
    { preHandler: [validateParams(sportSlugParamsSchema)] },
    async (request: FastifyRequest<{ Params: SportSlugParams }>, reply: FastifyReply) => {
      const sport = await sportsService.getSport(request.params.slug);
      if (!sport) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Sport not found.' },
        });
      }
      return reply.status(200).send({ success: true, data: { sport } });
    },
  );

  // ─── GET /api/v1/sports/:slug/competitions ──────────────────────────────
  fastify.get(
    '/sports/:slug/competitions',
    { preHandler: [validateParams(sportSlugParamsSchema)] },
    async (request: FastifyRequest<{ Params: SportSlugParams }>, reply: FastifyReply) => {
      const competitions = await sportsService.getCompetitionsWithEvents(request.params.slug);
      if (!competitions) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Sport not found.' },
        });
      }
      return reply.status(200).send({ success: true, data: { competitions } });
    },
  );


  // ─── GET /api/v1/sports/:slug/results ───────────────────────────────
  fastify.get(
    '/sports/:slug/results',
    { preHandler: [validateParams(sportSlugParamsSchema)] },
    async (request: FastifyRequest<{ Params: SportSlugParams }>, reply: FastifyReply) => {
      const competitions = await sportsService.getResultsWithEvents(request.params.slug);
      if (!competitions) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Sport not found.' },
        });
      }
      return reply.status(200).send({ success: true, data: { competitions } });
    },
  );
  // ─── GET /api/v1/sports/:slug/outrights ────────────────────────────────
  fastify.get(
    '/sports/:slug/outrights',
    { preHandler: [validateParams(sportSlugParamsSchema)] },
    async (request: FastifyRequest<{ Params: SportSlugParams }>, reply: FastifyReply) => {
      const result = await sportsService.getOutrightsBySport(request.params.slug);
      if (!result) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Sport not found.' },
        });
      }
      return reply.status(200).send({ success: true, data: result });
    },
  );

  // ─── GET /api/v1/competitions/:id/events ────────────────────────────────
  fastify.get(
    '/competitions/:id/events',
    { preHandler: [validateParams(competitionIdParamsSchema), validateQuery(competitionEventsQuerySchema)] },
    async (
      request: FastifyRequest<{ Params: CompetitionIdParams; Querystring: CompetitionEventsQuery }>,
      reply: FastifyReply,
    ) => {
      const result = await sportsService.getCompetitionEvents(request.params.id, request.query);
      return reply.status(200).send({ success: true, data: result });
    },
  );

  // ─── GET /api/v1/events/search ──────────────────────────────────────────
  // NOTE: This must be registered BEFORE /events/:id to avoid route collision
  fastify.get(
    '/events/search',
    { preHandler: [validateQuery(searchEventsQuerySchema)] },
    async (request: FastifyRequest<{ Querystring: SearchEventsQuery }>, reply: FastifyReply) => {
      const result = await sportsService.searchEvents(request.query);
      return reply.status(200).send({ success: true, data: result });
    },
  );

  // ─── GET /api/v1/events/live ────────────────────────────────────────────
  fastify.get(
    '/events/live',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const groups = await sportsService.getLiveEvents();
      return reply.status(200).send({ success: true, data: { groups } });
    },
  );

  // ─── GET /api/v1/events/featured ────────────────────────────────────────
  fastify.get(
    '/events/featured',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const events = await sportsService.getFeaturedEvents();
      return reply.status(200).send({ success: true, data: { events } });
    },
  );

  // ─── GET /api/v1/events ─────────────────────────────────────────────────
  fastify.get(
    '/events',
    { preHandler: [validateQuery(eventsQuerySchema)] },
    async (request: FastifyRequest<{ Querystring: EventsQuery }>, reply: FastifyReply) => {
      const result = await sportsService.getEvents(request.query);
      return reply.status(200).send({ success: true, data: result });
    },
  );

  // ─── GET /api/v1/events/:id ─────────────────────────────────────────────
  fastify.get(
    '/events/:id',
    { preHandler: [validateParams(eventIdParamsSchema)] },
    async (request: FastifyRequest<{ Params: EventIdParams }>, reply: FastifyReply) => {
      const event = await sportsService.getEvent(request.params.id);
      if (!event) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Event not found.' },
        });
      }
      return reply.status(200).send({ success: true, data: { event } });
    },
  );

  // ─── GET /api/v1/events/:id/markets ─────────────────────────────────────
  fastify.get(
    '/events/:id/markets',
    { preHandler: [validateParams(eventIdParamsSchema)] },
    async (request: FastifyRequest<{ Params: EventIdParams }>, reply: FastifyReply) => {
      const markets = await sportsService.getMarkets(request.params.id);
      return reply.status(200).send({ success: true, data: { markets } });
    },
  );

}
