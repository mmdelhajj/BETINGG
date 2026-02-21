import { z } from 'zod';

// ---------------------------------------------------------------------------
// Param schemas
// ---------------------------------------------------------------------------

export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

export type IdParam = z.infer<typeof idParamSchema>;

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

export const roomsQuerySchema = z.object({
  type: z.enum(['GENERAL', 'SPORT', 'CASINO', 'VIP']).optional(),
});

export type RoomsQuery = z.infer<typeof roomsQuerySchema>;

export const messagesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(100)),
  before: z.string().optional(),
});

export type MessagesQuery = z.infer<typeof messagesQuerySchema>;

// ---------------------------------------------------------------------------
// Body schemas
// ---------------------------------------------------------------------------

export const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(2000, 'Message must be at most 2000 characters'),
  replyToId: z.string().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const tipUserSchema = z.object({
  recipientId: z.string().min(1, 'Recipient ID is required'),
  amount: z
    .number()
    .positive('Tip amount must be positive')
    .min(0.01, 'Minimum tip is 0.01'),
  currency: z.string().min(1, 'Currency is required'),
  message: z.string().max(200, 'Tip message must be at most 200 characters').optional(),
});

export type TipUserInput = z.infer<typeof tipUserSchema>;
