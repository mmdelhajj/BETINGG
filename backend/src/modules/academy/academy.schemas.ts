import { z } from 'zod';

// ---------------------------------------------------------------------------
// Param schemas
// ---------------------------------------------------------------------------

export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

export type IdParam = z.infer<typeof idParamSchema>;

export const lessonParamSchema = z.object({
  id: z.string().min(1, 'Course ID is required'),
  lessonId: z.string().min(1, 'Lesson ID is required'),
});

export type LessonParam = z.infer<typeof lessonParamSchema>;

// ---------------------------------------------------------------------------
// Course schemas
// ---------------------------------------------------------------------------

export const createCourseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required'),
  thumbnail: z.string().url('Thumbnail must be a valid URL').optional(),
  category: z.string().max(50).optional(),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
  isPublished: z.boolean().optional().default(false),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;

export const updateCourseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  thumbnail: z.string().url().optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isPublished: z.boolean().optional(),
});

export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;

// ---------------------------------------------------------------------------
// Lesson schemas
// ---------------------------------------------------------------------------

export const createLessonSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required'),
  videoUrl: z.string().url('Video URL must be a valid URL').optional(),
  sortOrder: z.number().int().min(0),
  duration: z.number().int().min(0).optional(),
});

export type CreateLessonInput = z.infer<typeof createLessonSchema>;

export const updateLessonSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  videoUrl: z.string().url().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  duration: z.number().int().min(0).optional(),
});

export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

export const coursesQuerySchema = z.object({
  category: z.string().optional(),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
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

export type CoursesQuery = z.infer<typeof coursesQuerySchema>;

// ---------------------------------------------------------------------------
// Progress schemas
// ---------------------------------------------------------------------------

export const markCompleteSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  lessonId: z.string().min(1, 'Lesson ID is required'),
});

export type MarkCompleteInput = z.infer<typeof markCompleteSchema>;
