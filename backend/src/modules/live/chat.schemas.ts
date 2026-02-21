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
});

export type MessagesQuery = z.infer<typeof messagesQuerySchema>;

export const adminRoomsQuerySchema = z.object({
  status: z.enum(['OPEN', 'WAITING', 'CLOSED', 'all']).optional().default('OPEN'),
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

export type AdminRoomsQuery = z.infer<typeof adminRoomsQuerySchema>;

// ---------------------------------------------------------------------------
// Body schemas
// ---------------------------------------------------------------------------

export const createRoomSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const sendMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const assignRoomSchema = z.object({
  adminId: z.string().min(1, 'Admin ID is required'),
});

export type AssignRoomInput = z.infer<typeof assignRoomSchema>;
