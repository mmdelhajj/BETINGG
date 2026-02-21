import { z } from 'zod';

// ---------------------------------------------------------------------------
// Upload document body
// ---------------------------------------------------------------------------

export const uploadDocSchema = z.object({
  type: z.enum(['PASSPORT', 'DRIVERS_LICENSE', 'NATIONAL_ID', 'PROOF_OF_ADDRESS', 'SELFIE'], {
    required_error: 'Document type is required',
    invalid_type_error:
      'Document type must be one of: PASSPORT, DRIVERS_LICENSE, NATIONAL_ID, PROOF_OF_ADDRESS, SELFIE',
  }),
});

export type UploadDocInput = z.infer<typeof uploadDocSchema>;

// ---------------------------------------------------------------------------
// Review document body (admin)
// ---------------------------------------------------------------------------

export const reviewDocSchema = z
  .object({
    action: z.enum(['approve', 'reject'], {
      required_error: 'Action is required',
      invalid_type_error: 'Action must be "approve" or "reject"',
    }),
    reason: z.string().min(1, 'Reason is required when rejecting a document').optional(),
  })
  .refine(
    (data) => {
      if (data.action === 'reject' && (!data.reason || data.reason.trim().length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: 'Reason is required when rejecting a document.',
      path: ['reason'],
    },
  );

export type ReviewDocInput = z.infer<typeof reviewDocSchema>;

// ---------------------------------------------------------------------------
// Document ID param
// ---------------------------------------------------------------------------

export const docIdParamsSchema = z.object({
  id: z.string().min(1, 'Document ID is required'),
});

export type DocIdParams = z.infer<typeof docIdParamsSchema>;

// ---------------------------------------------------------------------------
// Pending queue query
// ---------------------------------------------------------------------------

export const pendingQueueQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

export type PendingQueueQuery = z.infer<typeof pendingQueueQuerySchema>;
