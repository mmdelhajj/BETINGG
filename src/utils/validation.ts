import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const slugParamSchema = z.object({
  slug: z.string().min(1),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const emailSchema = z.string().email().max(255).toLowerCase();
export const usernameSchema = z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/);
export const passwordSchema = z.string().min(8).max(128);
export const decimalSchema = z.string().regex(/^\d+(\.\d+)?$/, 'Must be a valid decimal number');
export const positiveDecimalSchema = decimalSchema.refine(
  (val) => parseFloat(val) > 0,
  'Must be a positive number'
);

export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function validateQuery<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function validateParams<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}
