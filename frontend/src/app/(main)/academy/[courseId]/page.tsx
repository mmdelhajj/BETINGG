'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  GraduationCap,
  BookOpen,
  Clock,
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronLeft,
  Play,
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { get, post as apiPost } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Lesson {
  id: string;
  title: string;
  slug: string;
  sortOrder: number;
  duration: number | null;
  videoUrl: string | null;
  completed: boolean;
}

interface CourseDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail: string | null;
  category: string | null;
  difficulty: string | null;
  lessonCount: number;
  completedLessons: number;
  progressPercent: number;
  lessons: Lesson[];
  createdAt: string;
}

interface LessonContent {
  lesson: {
    id: string;
    courseId: string;
    title: string;
    slug: string;
    content: string;
    videoUrl: string | null;
    sortOrder: number;
    duration: number | null;
  };
  courseTitle: string;
  prevLesson: { id: string; title: string } | null;
  nextLesson: { id: string; title: string } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  Intermediate: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  Advanced: 'bg-red-500/15 text-red-400 border-red-500/25',
};

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function CourseSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-5 bg-[#1C2128] rounded w-24" />
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 space-y-4">
        <div className="h-8 bg-[#1C2128] rounded w-2/3" />
        <div className="h-4 bg-[#1C2128] rounded w-full" />
        <div className="h-4 bg-[#1C2128] rounded w-1/2" />
        <div className="h-2 bg-[#1C2128] rounded-full w-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-[#161B22] border border-[#30363D] rounded-lg p-4">
            <div className="h-5 bg-[#1C2128] rounded w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Markdown Renderer
// ---------------------------------------------------------------------------

function MarkdownContent({ content }: { content: string }) {
  const html = content
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-[#E6EDF3] mt-6 mb-3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-[#E6EDF3] mt-8 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-[#E6EDF3] mt-10 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-[#E6EDF3]">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-[#1C2128] px-1.5 py-0.5 rounded text-sm text-[#8B5CF6] font-mono">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-[#8B5CF6] hover:underline" target="_blank" rel="noopener">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-[#8B949E]">$1</li>')
    .replace(/\n\n/g, '</p><p class="text-[#8B949E] leading-7 mb-3">')
    .replace(/\n/g, '<br />');

  return (
    <div
      className="text-[#8B949E] leading-7"
      dangerouslySetInnerHTML={{
        __html: `<p class="text-[#8B949E] leading-7 mb-3">${html}</p>`,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params?.courseId as string;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<LessonContent | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Fetch course
  useEffect(() => {
    if (!courseId) return;

    const fetchCourse = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const data = await get<{ course: CourseDetail }>(`/academy/courses/${courseId}`);
        setCourse(data?.course || null);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    void fetchCourse();
  }, [courseId]);

  // Load lesson content
  const loadLesson = useCallback(async (lessonId: string) => {
    if (!courseId) return;
    setLessonLoading(true);
    setActiveLessonId(lessonId);
    try {
      const data = await get<LessonContent>(
        `/academy/courses/${courseId}/lessons/${lessonId}`,
      );
      setSelectedLesson(data);
    } catch {
      setSelectedLesson(null);
    } finally {
      setLessonLoading(false);
    }
  }, [courseId]);

  // Mark lesson complete
  const markComplete = useCallback(async (lessonId: string) => {
    if (!courseId) return;
    try {
      await apiPost('/academy/progress', { courseId, lessonId });
      // Refresh course to get updated progress
      const data = await get<{ course: CourseDetail }>(`/academy/courses/${courseId}`);
      setCourse(data?.course || null);
    } catch {
      // User may not be logged in
    }
  }, [courseId]);

  const formatDuration = (mins: number | null) => {
    if (!mins) return null;
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <CourseSkeleton />
      </div>
    );
  }

  if (notFound || !course) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <GraduationCap className="w-16 h-16 text-[#484F58] mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-[#E6EDF3] mb-2">Course Not Found</h2>
        <p className="text-[#8B949E] mb-6">This course does not exist or is no longer available.</p>
        <Link
          href="/academy"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Academy
        </Link>
      </div>
    );
  }

  const totalDuration = course.lessons.reduce((acc, l) => acc + (l.duration ?? 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      {/* Back link */}
      <Link
        href="/academy"
        className="inline-flex items-center gap-1.5 text-sm text-[#8B949E] hover:text-[#8B5CF6] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Academy
      </Link>

      {/* Course Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 md:p-8"
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {course.difficulty && (
            <span
              className={cn(
                'text-xs font-medium px-2.5 py-1 rounded border',
                DIFFICULTY_COLORS[course.difficulty] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/25',
              )}
            >
              {course.difficulty}
            </span>
          )}
          {course.category && (
            <span className="text-xs font-medium px-2.5 py-1 rounded bg-[#1C2128] text-[#8B949E] border border-[#30363D]">
              {course.category}
            </span>
          )}
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-[#E6EDF3] mb-3">
          {course.title}
        </h1>
        <p className="text-[#8B949E] mb-6 max-w-3xl">{course.description}</p>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-6 text-sm text-[#8B949E] mb-4">
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4" />
            {course.lessonCount} lesson{course.lessonCount !== 1 ? 's' : ''}
          </span>
          {totalDuration > 0 && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {formatDuration(totalDuration)}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[#10B981]">
            <CheckCircle2 className="w-4 h-4" />
            {course.completedLessons}/{course.lessonCount} completed
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-[#1C2128] rounded-full h-2.5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${course.progressPercent}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={cn(
              'h-full rounded-full transition-colors',
              course.progressPercent === 100 ? 'bg-[#10B981]' : 'bg-[#8B5CF6]',
            )}
          />
        </div>
        <p className="text-xs text-[#8B949E] mt-2">{course.progressPercent}% complete</p>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Lesson List */}
        <div className={cn('space-y-2', selectedLesson ? 'lg:w-80 shrink-0' : 'w-full')}>
          <h2 className="text-lg font-semibold text-[#E6EDF3] mb-3">Lessons</h2>
          {(course.lessons || []).map((lesson, index) => (
            <button
              key={lesson.id}
              onClick={() => void loadLesson(lesson.id)}
              className={cn(
                'w-full text-left flex items-center gap-3 p-3 rounded-lg border transition-all group',
                activeLessonId === lesson.id
                  ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/40'
                  : 'bg-[#161B22] border-[#30363D] hover:border-[#8B5CF6]/30',
              )}
            >
              {/* Status icon */}
              <div className="shrink-0">
                {lesson.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-[#30363D] flex items-center justify-center text-[10px] text-[#8B949E] font-medium">
                    {index + 1}
                  </div>
                )}
              </div>

              {/* Lesson info */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-sm font-medium truncate',
                    activeLessonId === lesson.id
                      ? 'text-[#8B5CF6]'
                      : 'text-[#E6EDF3] group-hover:text-[#A78BFA]',
                  )}
                >
                  {lesson.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-[#8B949E] mt-0.5">
                  {lesson.duration && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {formatDuration(lesson.duration)}
                    </span>
                  )}
                  {lesson.videoUrl && (
                    <span className="flex items-center gap-0.5">
                      <Video className="w-3 h-3" />
                      Video
                    </span>
                  )}
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-[#484F58] group-hover:text-[#8B5CF6] shrink-0" />
            </button>
          ))}
        </div>

        {/* Lesson Content */}
        {(selectedLesson || lessonLoading) && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 min-w-0"
          >
            {lessonLoading ? (
              <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 animate-pulse space-y-4">
                <div className="h-8 bg-[#1C2128] rounded w-2/3" />
                <div className="h-4 bg-[#1C2128] rounded w-full" />
                <div className="h-4 bg-[#1C2128] rounded w-full" />
                <div className="h-4 bg-[#1C2128] rounded w-3/4" />
              </div>
            ) : selectedLesson ? (
              <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 md:p-8">
                {/* Video embed */}
                {selectedLesson.lesson.videoUrl && (
                  <div className="aspect-video bg-[#0D1117] rounded-lg mb-6 overflow-hidden border border-[#30363D]">
                    <iframe
                      src={selectedLesson.lesson.videoUrl}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}

                <h2 className="text-2xl font-bold text-[#E6EDF3] mb-6">
                  {selectedLesson.lesson.title}
                </h2>

                <MarkdownContent content={selectedLesson.lesson.content} />

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 mt-8 pt-6 border-t border-[#30363D]">
                  <div className="flex gap-3">
                    {selectedLesson.prevLesson && (
                      <button
                        onClick={() => void loadLesson(selectedLesson.prevLesson!.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm text-[#8B949E] border border-[#30363D] rounded-lg hover:border-[#8B5CF6]/30 hover:text-[#E6EDF3] transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </button>
                    )}
                    {selectedLesson.nextLesson && (
                      <button
                        onClick={() => void loadLesson(selectedLesson.nextLesson!.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm text-[#8B949E] border border-[#30363D] rounded-lg hover:border-[#8B5CF6]/30 hover:text-[#E6EDF3] transition-all"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => void markComplete(selectedLesson.lesson.id)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#10B981] text-white rounded-lg hover:bg-[#059669] transition-colors text-sm font-medium"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark as Complete
                  </button>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </div>
    </div>
  );
}
