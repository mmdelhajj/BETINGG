import { prisma } from '../../lib/prisma.js';
import type {
  CreateCourseInput,
  UpdateCourseInput,
  CreateLessonInput,
  UpdateLessonInput,
} from './academy.schemas.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export class AcademyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AcademyError';
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function uniqueCourseSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug;
  let counter = 0;
  while (true) {
    const existing = await prisma.academyCourse.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    counter++;
    slug = `${baseSlug}-${counter}`;
  }
}

// ---------------------------------------------------------------------------
// Public: Courses
// ---------------------------------------------------------------------------

export async function getCourses(userId?: string) {
  const courses = await prisma.academyCourse.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    include: {
      lessons: {
        select: { id: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  // If user is logged in, get their progress
  let progressMap = new Map<string, { completed: number; total: number }>();
  if (userId) {
    const progress = await prisma.userCourseProgress.findMany({
      where: { userId, completed: true },
      select: { courseId: true, lessonId: true },
    });

    for (const p of progress) {
      const entry = progressMap.get(p.courseId) ?? { completed: 0, total: 0 };
      entry.completed++;
      progressMap.set(p.courseId, entry);
    }
  }

  return courses.map((course) => {
    const lessonCount = course.lessons.length;
    const progressEntry = progressMap.get(course.id);
    const completedLessons = progressEntry?.completed ?? 0;
    const progressPercent = lessonCount > 0
      ? Math.round((completedLessons / lessonCount) * 100)
      : 0;

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      thumbnail: course.thumbnail,
      category: course.category,
      difficulty: course.difficulty,
      lessonCount,
      sortOrder: course.sortOrder,
      progressPercent,
      completedLessons,
      createdAt: course.createdAt,
    };
  });
}

export async function getCourse(id: string, userId?: string) {
  const course = await prisma.academyCourse.findUnique({
    where: { id },
    include: {
      lessons: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          title: true,
          slug: true,
          sortOrder: true,
          duration: true,
          videoUrl: true,
        },
      },
    },
  });

  if (!course || !course.isPublished) {
    throw new AcademyError('COURSE_NOT_FOUND', 'Course not found', 404);
  }

  // Get user's completion status per lesson
  let completedLessonIds = new Set<string>();
  if (userId) {
    const progress = await prisma.userCourseProgress.findMany({
      where: { userId, courseId: id, completed: true },
      select: { lessonId: true },
    });
    completedLessonIds = new Set(progress.map((p) => p.lessonId));
  }

  const lessons = course.lessons.map((lesson) => ({
    ...lesson,
    completed: completedLessonIds.has(lesson.id),
  }));

  const completedCount = lessons.filter((l) => l.completed).length;
  const progressPercent = lessons.length > 0
    ? Math.round((completedCount / lessons.length) * 100)
    : 0;

  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    thumbnail: course.thumbnail,
    category: course.category,
    difficulty: course.difficulty,
    lessonCount: lessons.length,
    completedLessons: completedCount,
    progressPercent,
    lessons,
    createdAt: course.createdAt,
  };
}

export async function getLesson(courseId: string, lessonId: string) {
  const course = await prisma.academyCourse.findUnique({
    where: { id: courseId },
    select: { id: true, isPublished: true, title: true },
  });

  if (!course || !course.isPublished) {
    throw new AcademyError('COURSE_NOT_FOUND', 'Course not found', 404);
  }

  const lesson = await prisma.academyLesson.findFirst({
    where: { id: lessonId, courseId },
  });

  if (!lesson) {
    throw new AcademyError('LESSON_NOT_FOUND', 'Lesson not found', 404);
  }

  // Get prev/next lessons for navigation
  const allLessons = await prisma.academyLesson.findMany({
    where: { courseId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, title: true, sortOrder: true },
  });

  const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  return {
    lesson,
    courseTitle: course.title,
    prevLesson,
    nextLesson,
  };
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export async function markComplete(userId: string, courseId: string, lessonId: string) {
  // Verify lesson exists in course
  const lesson = await prisma.academyLesson.findFirst({
    where: { id: lessonId, courseId },
  });

  if (!lesson) {
    throw new AcademyError('LESSON_NOT_FOUND', 'Lesson not found in this course', 404);
  }

  const progress = await prisma.userCourseProgress.upsert({
    where: {
      userId_courseId_lessonId: {
        userId,
        courseId,
        lessonId,
      },
    },
    update: {
      completed: true,
      completedAt: new Date(),
    },
    create: {
      userId,
      courseId,
      lessonId,
      completed: true,
      completedAt: new Date(),
    },
  });

  // Calculate overall course progress
  const totalLessons = await prisma.academyLesson.count({ where: { courseId } });
  const completedLessons = await prisma.userCourseProgress.count({
    where: { userId, courseId, completed: true },
  });

  return {
    progress,
    courseProgress: {
      totalLessons,
      completedLessons,
      progressPercent: totalLessons > 0
        ? Math.round((completedLessons / totalLessons) * 100)
        : 0,
    },
  };
}

export async function getUserProgress(userId: string) {
  const progress = await prisma.userCourseProgress.findMany({
    where: { userId, completed: true },
    select: {
      courseId: true,
      lessonId: true,
      completedAt: true,
    },
  });

  // Group by course
  const courseMap = new Map<string, { completedLessons: string[]; lastCompletedAt: Date | null }>();
  for (const p of progress) {
    const entry = courseMap.get(p.courseId) ?? { completedLessons: [], lastCompletedAt: null };
    entry.completedLessons.push(p.lessonId);
    if (p.completedAt && (!entry.lastCompletedAt || p.completedAt > entry.lastCompletedAt)) {
      entry.lastCompletedAt = p.completedAt;
    }
    courseMap.set(p.courseId, entry);
  }

  // Get course info for all courses the user has progress in
  const courseIds = Array.from(courseMap.keys());
  if (courseIds.length === 0) return [];

  const courses = await prisma.academyCourse.findMany({
    where: { id: { in: courseIds } },
    include: {
      lessons: {
        select: { id: true },
      },
    },
  });

  return courses.map((course) => {
    const entry = courseMap.get(course.id)!;
    const totalLessons = course.lessons.length;
    const completedCount = entry.completedLessons.length;

    return {
      courseId: course.id,
      courseTitle: course.title,
      courseSlug: course.slug,
      thumbnail: course.thumbnail,
      difficulty: course.difficulty,
      totalLessons,
      completedLessons: completedCount,
      progressPercent: totalLessons > 0
        ? Math.round((completedCount / totalLessons) * 100)
        : 0,
      lastCompletedAt: entry.lastCompletedAt,
    };
  });
}

// ---------------------------------------------------------------------------
// Admin: Courses
// ---------------------------------------------------------------------------

export async function adminCreateCourse(data: CreateCourseInput) {
  const slug = await uniqueCourseSlug(slugify(data.title));

  return prisma.academyCourse.create({
    data: {
      title: data.title,
      slug,
      description: data.description,
      thumbnail: data.thumbnail ?? null,
      category: data.category ?? null,
      difficulty: data.difficulty ?? null,
      sortOrder: data.sortOrder ?? 0,
      isPublished: data.isPublished ?? false,
    },
  });
}

export async function adminUpdateCourse(id: string, data: UpdateCourseInput) {
  const existing = await prisma.academyCourse.findUnique({ where: { id } });
  if (!existing) {
    throw new AcademyError('COURSE_NOT_FOUND', 'Course not found', 404);
  }

  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) {
    updateData.title = data.title;
    updateData.slug = await uniqueCourseSlug(slugify(data.title), id);
  }
  if (data.description !== undefined) updateData.description = data.description;
  if (data.thumbnail !== undefined) updateData.thumbnail = data.thumbnail;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;

  return prisma.academyCourse.update({
    where: { id },
    data: updateData,
  });
}

export async function adminDeleteCourse(id: string) {
  const existing = await prisma.academyCourse.findUnique({ where: { id } });
  if (!existing) {
    throw new AcademyError('COURSE_NOT_FOUND', 'Course not found', 404);
  }

  // Delete all progress and lessons first (cascade should handle this)
  await prisma.academyCourse.delete({ where: { id } });
  return { message: 'Course deleted successfully' };
}

// ---------------------------------------------------------------------------
// Admin: Lessons
// ---------------------------------------------------------------------------

export async function adminCreateLesson(data: CreateLessonInput) {
  const course = await prisma.academyCourse.findUnique({ where: { id: data.courseId } });
  if (!course) {
    throw new AcademyError('COURSE_NOT_FOUND', 'Course not found', 404);
  }

  const slug = slugify(data.title);

  const lesson = await prisma.academyLesson.create({
    data: {
      courseId: data.courseId,
      title: data.title,
      slug,
      content: data.content,
      videoUrl: data.videoUrl ?? null,
      sortOrder: data.sortOrder,
      duration: data.duration ?? null,
    },
  });

  // Update lesson count on course
  const lessonCount = await prisma.academyLesson.count({ where: { courseId: data.courseId } });
  await prisma.academyCourse.update({
    where: { id: data.courseId },
    data: { lessonCount },
  });

  return lesson;
}

export async function adminUpdateLesson(id: string, data: UpdateLessonInput) {
  const existing = await prisma.academyLesson.findUnique({ where: { id } });
  if (!existing) {
    throw new AcademyError('LESSON_NOT_FOUND', 'Lesson not found', 404);
  }

  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) {
    updateData.title = data.title;
    updateData.slug = slugify(data.title);
  }
  if (data.content !== undefined) updateData.content = data.content;
  if (data.videoUrl !== undefined) updateData.videoUrl = data.videoUrl;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (data.duration !== undefined) updateData.duration = data.duration;

  return prisma.academyLesson.update({
    where: { id },
    data: updateData,
  });
}

export async function adminDeleteLesson(id: string) {
  const existing = await prisma.academyLesson.findUnique({ where: { id } });
  if (!existing) {
    throw new AcademyError('LESSON_NOT_FOUND', 'Lesson not found', 404);
  }

  await prisma.academyLesson.delete({ where: { id } });

  // Update lesson count on course
  const lessonCount = await prisma.academyLesson.count({ where: { courseId: existing.courseId } });
  await prisma.academyCourse.update({
    where: { id: existing.courseId },
    data: { lessonCount },
  });

  return { message: 'Lesson deleted successfully' };
}
