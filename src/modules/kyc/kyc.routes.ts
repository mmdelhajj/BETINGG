import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { kycService } from './kyc.service';
import { authMiddleware, adminGuard } from '../../middleware/auth';
import { sendSuccess, sendCreated } from '../../utils/response';
import { paginationSchema } from '../../utils/validation';

export default async function kycRoutes(app: FastifyInstance): Promise<void> {
  app.post('/documents', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = z.object({
      type: z.enum(['PASSPORT', 'DRIVERS_LICENSE', 'NATIONAL_ID', 'PROOF_OF_ADDRESS', 'SELFIE']),
      fileUrl: z.string().url(),
    }).parse(request.body);
    const document = await kycService.uploadDocument(request.user!.userId, body);
    sendCreated(reply, document);
  });

  app.get('/documents', { preHandler: [authMiddleware] }, async (request, reply) => {
    const documents = await kycService.getDocuments(request.user!.userId);
    sendSuccess(reply, documents);
  });

  app.get('/status', { preHandler: [authMiddleware] }, async (request, reply) => {
    const status = await kycService.getKycStatus(request.user!.userId);
    sendSuccess(reply, status);
  });

  app.get('/pending', { preHandler: [adminGuard] }, async (request, reply) => {
    const query = paginationSchema.parse(request.query);
    const result = await kycService.getPendingDocuments(query);
    sendSuccess(reply, result.documents, result.meta);
  });

  app.post('/review/:id', { preHandler: [adminGuard] }, async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({
      status: z.enum(['APPROVED', 'REJECTED']),
      reviewNote: z.string().max(1000).optional(),
    }).parse(request.body);
    const result = await kycService.reviewDocument(id, request.user!.userId, body);
    sendSuccess(reply, result);
  });
}
