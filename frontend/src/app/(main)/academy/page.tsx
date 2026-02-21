'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  BookOpen,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Play,
  Clock,
  Users,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { get } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail: string | null;
  category: string | null;
  difficulty: string | null;
  lessonCount: number;
  sortOrder: number;
  progressPercent: number;
  completedLessons: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIFFICULTY_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Beginner: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  Intermediate: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400' },
  Advanced: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', dot: 'bg-red-400' },
};

const DEFAULT_DIFFICULTY = { bg: 'bg-[#8B949E]/10', text: 'text-[#8B949E]', border: 'border-[#8B949E]/20', dot: 'bg-[#8B949E]' };

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CourseSkeleton() {
  return (
    <div className="bg-[#161B22] border border-[#21262D] rounded-xl overflow-hidden animate-pulse">
      <div className="h-48 bg-gradient-to-br from-[#1C2128] to-[#161B22]" />
      <div className="p-5 space-y-3">
        <div className="flex gap-2">
          <div className="h-5 bg-[#1C2128] rounded-full w-20" />
          <div className="h-5 bg-[#1C2128] rounded-full w-16" />
        </div>
        <div className="h-6 bg-[#1C2128] rounded w-3/4" />
        <div className="h-4 bg-[#1C2128] rounded w-full" />
        <div className="h-4 bg-[#1C2128] rounded w-2/3" />
        <div className="h-2 bg-[#1C2128] rounded-full w-full" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress Bar
// ---------------------------------------------------------------------------

function ProgressBar({ percent, isComplete }: { percent: number; isComplete: boolean }) {
  return (
    <div className="w-full bg-[#0D1117] rounded-full h-2 overflow-hidden border border-[#21262D]">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={cn(
          'h-full rounded-full transition-colors',
          isComplete
            ? 'bg-gradient-to-r from-[#10B981] to-[#34D399]'
            : 'bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA]',
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Course Card
// ---------------------------------------------------------------------------

function CourseCard({ course }: { course: Course }) {
  const hasProgress = course.progressPercent > 0;
  const isComplete = course.progressPercent === 100;
  const diffColor = DIFFICULTY_COLORS[course.difficulty ?? ''] ?? DEFAULT_DIFFICULTY;

  return (
    <Link href={`/academy/${course.id}`}>
      <article className="bg-[#161B22] border border-[#21262D] rounded-xl overflow-hidden group hover:border-[#8B5CF6]/40 hover:shadow-xl hover:shadow-[#8B5CF6]/5 transition-all duration-300 h-full flex flex-col">
        {/* Thumbnail */}
        <div className="h-48 relative overflow-hidden">
          {course.thumbnail ? (
            <img
              src={course.thumbnail}
              alt={course.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#8B5CF6]/15 via-[#1C2128] to-[#10B981]/10 flex items-center justify-center">
              <GraduationCap className="w-16 h-16 text-[#8B5CF6]/20" />
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#161B22] to-transparent" />
          {/* Hover play button */}
          <div className="absolute inset-0 bg-[#0D1117]/0 group-hover:bg-[#0D1117]/30 transition-all duration-300 flex items-center justify-center">
            <div className="w-14 h-14 bg-[#8B5CF6] rounded-full flex items-center justify-center shadow-lg shadow-[#8B5CF6]/30 opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100">
              <Play className="w-6 h-6 text-white ml-0.5" />
            </div>
          </div>
          {/* Completion badge */}
          {isComplete && (
            <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-[#10B981]/20 border border-[#10B981]/30 backdrop-blur-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
              <span className="text-[10px] font-semibold text-[#10B981]">Complete</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col flex-1">
          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            {course.difficulty && (
              <span
                className={cn(
                  'text-[10px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1',
                  diffColor.bg,
                  diffColor.text,
                  diffColor.border,
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', diffColor.dot)} />
                {course.difficulty}
              </span>
            )}
            {course.category && (
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#8B5CF6]/10 text-[#A78BFA] border border-[#8B5CF6]/20">
                {course.category}
              </span>
            )}
          </div>

          <h3 className="font-bold text-[#E6EDF3] mb-2 line-clamp-2 group-hover:text-[#A78BFA] transition-colors duration-200 leading-snug">
            {course.title}
          </h3>
          <p className="text-sm text-[#8B949E] mb-4 line-clamp-2 flex-1 leading-relaxed">
            {course.description}
          </p>

          {/* Lesson count + progress */}
          <div className="flex items-center gap-4 text-xs text-[#6E7681] mb-3">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#8B949E]" />
              <span className="text-[#8B949E]">{course.lessonCount} lesson{course.lessonCount !== 1 ? 's' : ''}</span>
            </span>
            {hasProgress && (
              <span className="flex items-center gap-1.5 text-[#10B981]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {course.completedLessons}/{course.lessonCount} done
              </span>
            )}
          </div>

          {/* Progress bar */}
          {hasProgress && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-[#6E7681] font-medium">Progress</span>
                <span className={cn(
                  'text-[10px] font-bold font-mono',
                  isComplete ? 'text-[#10B981]' : 'text-[#A78BFA]',
                )}>
                  {Math.round(course.progressPercent)}%
                </span>
              </div>
              <ProgressBar percent={course.progressPercent} isComplete={isComplete} />
            </div>
          )}

          {/* Action footer */}
          <div className="mt-auto pt-3 border-t border-[#21262D]">
            {!hasProgress && (
              <span className="flex items-center gap-1.5 text-xs text-[#8B5CF6] font-semibold group-hover:gap-2.5 transition-all duration-200">
                Start Learning <ChevronRight className="w-3.5 h-3.5" />
              </span>
            )}
            {hasProgress && !isComplete && (
              <span className="flex items-center gap-1.5 text-xs text-[#8B5CF6] font-semibold group-hover:gap-2.5 transition-all duration-200">
                Continue Learning <ChevronRight className="w-3.5 h-3.5" />
              </span>
            )}
            {isComplete && (
              <span className="flex items-center gap-1.5 text-xs text-[#10B981] font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> Course Completed
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AcademyPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      try {
        const data = await get<{ courses: Course[] }>('/academy/courses');
        setCourses(data?.courses || []);
      } catch {
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };
    void fetchCourses();
  }, []);

  const difficulties = useMemo(() => {
    return Array.from(new Set(courses.map((c) => c.difficulty).filter(Boolean))) as string[];
  }, [courses]);

  const filteredCourses = filter
    ? courses.filter((c) => c.difficulty === filter)
    : courses;

  // Stats
  const totalLessons = courses.reduce((acc, c) => acc + c.lessonCount, 0);
  const completedCourses = courses.filter((c) => c.progressPercent === 100).length;

  return (
    <div className="min-h-screen bg-[#0D1117]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[#8B5CF6]" />
            </div>
            <h1 className="text-3xl font-bold text-[#E6EDF3]">Betting Academy</h1>
          </div>
          <p className="text-[#8B949E] max-w-2xl ml-[52px] leading-relaxed">
            Master the fundamentals of sports betting and crypto gaming. From beginner basics to advanced strategies, learn at your own pace.
          </p>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="bg-[#161B22] border border-[#21262D] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-[#8B5CF6]" />
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-[#E6EDF3]">{courses.length}</p>
              <p className="text-xs text-[#6E7681]">Courses</p>
            </div>
          </div>
          <div className="bg-[#161B22] border border-[#21262D] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#10B981]/10 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-[#10B981]" />
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-[#E6EDF3]">{totalLessons}</p>
              <p className="text-xs text-[#6E7681]">Lessons</p>
            </div>
          </div>
          <div className="bg-[#161B22] border border-[#21262D] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-[#E6EDF3]">{completedCourses}</p>
              <p className="text-xs text-[#6E7681]">Completed</p>
            </div>
          </div>
        </motion.div>

        {/* Difficulty Filter */}
        {difficulties.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex gap-2 flex-wrap"
          >
            <button
              onClick={() => setFilter(null)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                !filter
                  ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/25'
                  : 'bg-[#161B22] text-[#8B949E] border border-[#21262D] hover:border-[#8B5CF6]/30 hover:text-[#E6EDF3] hover:bg-[#1C2128]',
              )}
            >
              All Levels
            </button>
            {difficulties.map((diff) => {
              const dc = DIFFICULTY_COLORS[diff] ?? DEFAULT_DIFFICULTY;
              return (
                <button
                  key={diff}
                  onClick={() => setFilter(diff)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    filter === diff
                      ? 'bg-[#8B5CF6] text-white shadow-lg shadow-[#8B5CF6]/25'
                      : 'bg-[#161B22] text-[#8B949E] border border-[#21262D] hover:border-[#8B5CF6]/30 hover:text-[#E6EDF3] hover:bg-[#1C2128]',
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full', filter === diff ? 'bg-white' : dc.dot)} />
                  {diff}
                </button>
              );
            })}
          </motion.div>
        )}

        {/* Course Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <CourseSkeleton key={i} />
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-[#161B22] border border-[#21262D] flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-[#6E7681]" />
            </div>
            <h3 className="text-xl font-semibold text-[#E6EDF3] mb-2">No courses available</h3>
            <p className="text-[#8B949E] text-sm">
              New courses are being prepared. Check back soon.
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredCourses.map((course) => (
              <motion.div key={course.id} variants={cardVariants}>
                <CourseCard course={course} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
