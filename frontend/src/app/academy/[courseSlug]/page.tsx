'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function CoursePage() {
  const { courseSlug } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get(`/academy/courses/${courseSlug}`).then(({ data }) => {
      setCourse(data.data);
      if (data.data?.id) {
        api.get(`/academy/progress/${data.data.id}`).then(({ data: p }) => {
          setProgress(p.data);
        }).catch(() => {});
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [courseSlug]);

  if (isLoading) return <div className="max-w-3xl mx-auto"><div className="card h-48 animate-pulse bg-surface-tertiary" /></div>;
  if (!course) return <div className="max-w-3xl mx-auto text-center py-20"><h1 className="text-xl font-bold">Course not found</h1></div>;

  const completedLessons = progress?.completedLessons || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/academy" className="text-sm text-brand-400 hover:underline">&larr; Back to Academy</Link>

      <div className="card">
        <span className="text-xs text-brand-400 capitalize">{course.category?.replace(/-/g, ' ')}</span>
        <h1 className="text-2xl font-bold mt-1">{course.title}</h1>
        <p className="text-sm text-gray-400 mt-2">{course.description}</p>
        <p className="text-xs text-gray-500 mt-2">{course.lessons?.length || 0} lessons</p>

        {progress && (
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1">
              <span>Progress</span>
              <span>{completedLessons.length}/{course.lessons?.length || 0}</span>
            </div>
            <div className="w-full h-2 bg-surface-tertiary rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all"
                style={{ width: `${course.lessons?.length ? (completedLessons.length / course.lessons.length) * 100 : 0}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Lesson List */}
      <div className="space-y-2">
        {course.lessons?.map((lesson: any, idx: number) => {
          const isCompleted = completedLessons.includes(lesson.id);
          const isCurrent = progress?.lessonId === lesson.id;

          return (
            <Link
              key={lesson.id}
              href={`/academy/${courseSlug}/${lesson.slug}`}
              className={cn(
                'card flex items-center gap-3 transition-colors',
                isCurrent ? 'border-brand-500' : 'hover:border-brand-500/50'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                isCompleted ? 'bg-accent-green/20 text-accent-green' :
                isCurrent ? 'bg-brand-500/20 text-brand-400' :
                'bg-surface-tertiary text-gray-500'
              )}>
                {isCompleted ? '✓' : idx + 1}
              </div>
              <div className="flex-1">
                <p className={cn('text-sm font-medium', isCompleted && 'text-gray-500')}>{lesson.title}</p>
                {lesson.quizQuestions && (
                  <span className="text-xs text-gray-600">Includes quiz</span>
                )}
              </div>
              {isCurrent && <span className="text-xs text-brand-400">Continue</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
