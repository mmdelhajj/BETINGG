import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { AppError } from '../../utils/errors';

export class AcademyService {
  // ─── Public ───────────────────────────────────────────────
  async listCourses(opts: { category?: string }) {
    const where: any = { isActive: true };
    if (opts.category) where.category = opts.category;

    return prisma.academyCourse.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: { lessons: { select: { id: true, title: true, slug: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } } },
    });
  }

  async getCourse(slug: string) {
    const course = await prisma.academyCourse.findUnique({
      where: { slug },
      include: { lessons: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!course || !course.isActive) throw new AppError('COURSE_NOT_FOUND', 'Course not found', 404);
    return course;
  }

  async getLesson(courseSlug: string, lessonSlug: string) {
    const course = await prisma.academyCourse.findUnique({ where: { slug: courseSlug } });
    if (!course || !course.isActive) throw new AppError('COURSE_NOT_FOUND', 'Course not found', 404);

    const lesson = await prisma.academyLesson.findFirst({
      where: { courseId: course.id, slug: lessonSlug },
    });
    if (!lesson) throw new AppError('LESSON_NOT_FOUND', 'Lesson not found', 404);

    return { course, lesson };
  }

  // ─── User Progress ────────────────────────────────────────
  async getProgress(userId: string) {
    return prisma.userCourseProgress.findMany({
      where: { userId },
    });
  }

  async getCourseProgress(userId: string, courseId: string) {
    return prisma.userCourseProgress.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
  }

  async completeLesson(userId: string, courseId: string, lessonId: string, quizScore?: number) {
    const course = await prisma.academyCourse.findUnique({
      where: { id: courseId },
      include: { lessons: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!course) throw new AppError('COURSE_NOT_FOUND', 'Course not found', 404);

    const lesson = course.lessons.find(l => l.id === lessonId);
    if (!lesson) throw new AppError('LESSON_NOT_FOUND', 'Lesson not found', 404);

    let progress = await prisma.userCourseProgress.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    const completedLessons = progress ? [...new Set([...progress.completedLessons, lessonId])] : [lessonId];
    const quizScores = progress?.quizScores as Record<string, number> || {};
    if (quizScore !== undefined) quizScores[lessonId] = quizScore;

    const allComplete = course.lessons.every(l => completedLessons.includes(l.id));
    const nextLesson = course.lessons.find(l => !completedLessons.includes(l.id));

    if (progress) {
      progress = await prisma.userCourseProgress.update({
        where: { id: progress.id },
        data: {
          completedLessons,
          lessonId: nextLesson?.id || lessonId,
          quizScores,
          completedAt: allComplete ? new Date() : null,
        },
      });
    } else {
      progress = await prisma.userCourseProgress.create({
        data: {
          userId,
          courseId,
          lessonId: nextLesson?.id || lessonId,
          completedLessons,
          quizScores,
          completedAt: allComplete ? new Date() : null,
        },
      });
    }

    return { progress, courseComplete: allComplete };
  }

  // ─── Admin ────────────────────────────────────────────────
  async adminListCourses() {
    return prisma.academyCourse.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { lessons: true } } },
    });
  }

  async createCourse(data: {
    title: string; slug: string; description: string;
    thumbnail?: string; category: string; sortOrder?: number;
  }) {
    const existing = await prisma.academyCourse.findUnique({ where: { slug: data.slug } });
    if (existing) throw new AppError('SLUG_EXISTS', 'A course with this slug already exists', 409);

    return prisma.academyCourse.create({
      data: {
        title: data.title,
        slug: data.slug,
        description: data.description,
        thumbnail: data.thumbnail,
        category: data.category,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async updateCourse(id: string, data: Partial<{
    title: string; slug: string; description: string;
    thumbnail: string; category: string; sortOrder: number; isActive: boolean;
  }>) {
    return prisma.academyCourse.update({ where: { id }, data });
  }

  async deleteCourse(id: string) {
    await prisma.academyLesson.deleteMany({ where: { courseId: id } });
    await prisma.academyCourse.delete({ where: { id } });
  }

  async createLesson(data: {
    courseId: string; title: string; slug: string;
    content: string; sortOrder?: number; quizQuestions?: any;
  }) {
    return prisma.academyLesson.create({
      data: {
        courseId: data.courseId,
        title: data.title,
        slug: data.slug,
        content: data.content,
        sortOrder: data.sortOrder ?? 0,
        quizQuestions: data.quizQuestions,
      },
    });
  }

  async updateLesson(id: string, data: Partial<{
    title: string; slug: string; content: string;
    sortOrder: number; quizQuestions: any;
  }>) {
    return prisma.academyLesson.update({ where: { id }, data });
  }

  async deleteLesson(id: string) {
    await prisma.academyLesson.delete({ where: { id } });
  }
}

export const academyService = new AcademyService();
