import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, adminGuard } from '../../middleware/auth.js';
import { validate, validateParams, validateQuery } from '../../middleware/validate.js';
import {
  uploadDocSchema,
  reviewDocSchema,
  docIdParamsSchema,
  pendingQueueQuerySchema,
  type ReviewDocInput,
  type DocIdParams,
  type PendingQueueQuery,
} from './kyc.schemas.js';
import * as kycService from './kyc.service.js';

// ---------------------------------------------------------------------------
// User KYC routes — /api/v1/kyc
// ---------------------------------------------------------------------------

export async function kycRoutes(fastify: FastifyInstance): Promise<void> {
  // All KYC user routes require authentication
  fastify.addHook('preHandler', authenticate);

  // ─── GET /api/v1/kyc/status ────────────────────────────────────────────────
  fastify.get(
    '/status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const result = await kycService.getKycStatus(userId);

      if (!result) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found.',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── POST /api/v1/kyc/documents ───────────────────────────────────────────
  fastify.post(
    '/documents',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;

      // Handle multipart form data
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No file uploaded. Please attach a document file.',
          },
        });
      }

      // Validate document type from form field
      const typeField = data.fields?.type;
      let docType: string | undefined;

      if (typeField && 'value' in typeField) {
        docType = (typeField as { value: string }).value;
      }

      if (!docType) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Document type is required. Must be one of: PASSPORT, DRIVERS_LICENSE, NATIONAL_ID, PROOF_OF_ADDRESS, SELFIE.',
          },
        });
      }

      // Validate the type field using Zod
      const parseResult = uploadDocSchema.safeParse({ type: docType });
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parseResult.error.issues[0]?.message ?? 'Invalid document type.',
          },
        });
      }

      // Validate file size (max 10MB)
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      const fileBuffer = await data.toBuffer();

      if (fileBuffer.length > MAX_FILE_SIZE) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File size exceeds the 10MB limit.',
          },
        });
      }

      // Validate file type (images and PDFs only)
      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf',
      ];

      if (!allowedMimeTypes.includes(data.mimetype)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: 'Only JPEG, PNG, WebP, GIF, and PDF files are accepted.',
          },
        });
      }

      const result = await kycService.uploadDocument(
        userId,
        parseResult.data.type,
        fileBuffer,
        data.filename,
      );

      if ('error' in result) {
        return reply.status(409).send({
          success: false,
          error: {
            code: result.error,
            message: result.message,
          },
        });
      }

      return reply.status(201).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── GET /api/v1/kyc/documents ────────────────────────────────────────────
  fastify.get(
    '/documents',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.id;
      const documents = await kycService.getUserDocuments(userId);

      return reply.status(200).send({
        success: true,
        data: { documents },
      });
    },
  );
}

// ---------------------------------------------------------------------------
// Admin KYC routes — /api/v1/admin/kyc
// ---------------------------------------------------------------------------

export async function adminKycRoutes(fastify: FastifyInstance): Promise<void> {
  // All admin routes require authentication + admin guard
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', adminGuard);

  // ─── GET /api/v1/admin/kyc/queue ──────────────────────────────────────────
  fastify.get(
    '/queue',
    {
      preHandler: [validateQuery(pendingQueueQuerySchema)],
    },
    async (
      request: FastifyRequest<{ Querystring: PendingQueueQuery }>,
      reply: FastifyReply,
    ) => {
      const { page, limit } = request.query;
      const result = await kycService.getPendingQueue(page, limit);

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── GET /api/v1/admin/kyc/:id ───────────────────────────────────────────
  fastify.get(
    '/:id',
    {
      preHandler: [validateParams(docIdParamsSchema)],
    },
    async (
      request: FastifyRequest<{ Params: DocIdParams }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const document = await kycService.getDocumentById(id);

      if (!document) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'KYC document not found.',
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: { document },
      });
    },
  );

  // ─── POST /api/v1/admin/kyc/:id/approve ──────────────────────────────────
  fastify.post(
    '/:id/approve',
    {
      preHandler: [validateParams(docIdParamsSchema)],
    },
    async (
      request: FastifyRequest<{ Params: DocIdParams }>,
      reply: FastifyReply,
    ) => {
      const adminId = request.user!.id;
      const { id } = request.params;

      const result = await kycService.approveDocument(id, adminId);

      if ('error' in result) {
        const statusCode = result.error === 'NOT_FOUND' ? 404 : 409;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: result.error,
            message: result.message,
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );

  // ─── POST /api/v1/admin/kyc/:id/reject ───────────────────────────────────
  fastify.post(
    '/:id/reject',
    {
      preHandler: [validateParams(docIdParamsSchema), validate(reviewDocSchema)],
    },
    async (
      request: FastifyRequest<{
        Params: DocIdParams;
        Body: ReviewDocInput;
      }>,
      reply: FastifyReply,
    ) => {
      const adminId = request.user!.id;
      const { id } = request.params;
      const { reason } = request.body;

      const result = await kycService.rejectDocument(id, adminId, reason ?? '');

      if ('error' in result) {
        const statusCode = result.error === 'NOT_FOUND' ? 404 : 409;
        return reply.status(statusCode).send({
          success: false,
          error: {
            code: result.error,
            message: result.message,
          },
        });
      }

      return reply.status(200).send({
        success: true,
        data: result,
      });
    },
  );
}

export default kycRoutes;
