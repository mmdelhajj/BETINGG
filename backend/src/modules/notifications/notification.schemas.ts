import { z } from 'zod';

// ---------------------------------------------------------------------------
// Query: List notifications
// ---------------------------------------------------------------------------

export const listNotificationsQuerySchema = z.object({
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
  unreadOnly: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

// ---------------------------------------------------------------------------
// Params: Notification ID
// ---------------------------------------------------------------------------

export const notificationIdParamsSchema = z.object({
  id: z.string().min(1, 'Notification ID is required'),
});

export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>;
