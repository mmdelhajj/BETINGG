import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { academyService } from './academy.service';
import { authMiddleware } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';

const createCourseSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().min(1),
  thumbnail: z.string().url().optional(),
  category: z.enum(['crypto-basics', 'sports-betting', 'advanced', 'esports', 'responsible-gambling']),
  sortOrder: z.number().int().optional(),
});

const createLessonSchema = z.object({
  courseId: z.string(),
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  content: z.string().min(1),
  sortOrder: z.number().int().optional(),
  quizQuestions: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()).min(2).max(6),
    correctAnswer: z.number().int().min(0),
  })).optional(),
});

export default async function academyRoutes(app: FastifyInstance) {
  // ─── Public ───────────────────────────────────────────
  app.get('/academy/courses', async (request, reply) => {
    const { category } = request.query as any;
    const courses = await academyService.listCourses({ category });
    sendSuccess(reply, courses);
  });

  app.get('/academy/courses/:slug', async (request, reply) => {
    const { slug } = request.params as any;
    const course = await academyService.getCourse(slug);
    sendSuccess(reply, course);
  });

  app.get('/academy/courses/:courseSlug/lessons/:lessonSlug', async (request, reply) => {
    const { courseSlug, lessonSlug } = request.params as any;
    const data = await academyService.getLesson(courseSlug, lessonSlug);
    sendSuccess(reply, data);
  });

  // ─── User Progress (authenticated) ────────────────────
  app.get('/academy/progress', { preHandler: [authMiddleware] }, async (request, reply) => {
    const progress = await academyService.getProgress(request.user!.userId);
    sendSuccess(reply, progress);
  });

  app.get('/academy/progress/:courseId', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { courseId } = request.params as any;
    const progress = await academyService.getCourseProgress(request.user!.userId, courseId);
    sendSuccess(reply, progress);
  });

  app.post('/academy/progress/complete-lesson', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { courseId, lessonId, quizScore } = request.body as any;
    const result = await academyService.completeLesson(
      request.user!.userId, courseId, lessonId, quizScore
    );
    sendSuccess(reply, result);
  });

  // ─── Admin ────────────────────────────────────────────
  app.get('/admin/academy/courses', { preHandler: [authMiddleware] }, async (request, reply) => {
    const courses = await academyService.adminListCourses();
    sendSuccess(reply, courses);
  });

  app.post('/admin/academy/courses', { preHandler: [authMiddleware] }, async (request, reply) => {
    const data = createCourseSchema.parse(request.body);
    const course = await academyService.createCourse(data);
    sendSuccess(reply, course);
  });

  app.put('/admin/academy/courses/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as any;
    const data = createCourseSchema.partial().parse(request.body);
    const course = await academyService.updateCourse(id, data);
    sendSuccess(reply, course);
  });

  app.delete('/admin/academy/courses/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as any;
    await academyService.deleteCourse(id);
    sendSuccess(reply, { deleted: true });
  });

  app.post('/admin/academy/lessons', { preHandler: [authMiddleware] }, async (request, reply) => {
    const data = createLessonSchema.parse(request.body);
    const lesson = await academyService.createLesson(data);
    sendSuccess(reply, lesson);
  });

  app.put('/admin/academy/lessons/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as any;
    const data = createLessonSchema.partial().parse(request.body);
    const lesson = await academyService.updateLesson(id, data);
    sendSuccess(reply, lesson);
  });

  app.delete('/admin/academy/lessons/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params as any;
    await academyService.deleteLesson(id);
    sendSuccess(reply, { deleted: true });
  });
}
