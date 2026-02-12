'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const CATEGORY_COLORS: Record<string, string> = {
  'crypto-basics': 'from-orange-500 to-orange-700',
  'sports-betting': 'from-green-500 to-green-700',
  'advanced': 'from-purple-500 to-purple-700',
  'esports': 'from-blue-500 to-blue-700',
  'responsible-gambling': 'from-red-500 to-red-700',
};

export default function AcademyPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/academy/courses'),
      api.get('/academy/progress').catch(() => ({ data: { data: [] } })),
    ]).then(([coursesRes, progressRes]) => {
      setCourses(coursesRes.data.data || []);
      setProgress(progressRes.data.data || []);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  const getProgress = (courseId: string) => {
    const p = progress.find((pr: any) => pr.courseId === courseId);
    if (!p) return null;
    return p;
  };

  if (isLoading) return <div className="max-w-5xl mx-auto"><div className="card h-64 animate-pulse bg-surface-tertiary" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Hero */}
      <div className="card bg-gradient-to-r from-brand-600 to-brand-800 border-0 text-center py-10">
        <h1 className="text-3xl font-bold mb-2">CryptoBet Academy</h1>
        <p className="text-gray-200 max-w-lg mx-auto">
          Free courses on crypto betting, sports strategies, and responsible gambling. Learn at your own pace and test your knowledge.
        </p>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => {
          const prog = getProgress(course.id);
          const completedCount = prog?.completedLessons?.length || 0;
          const totalLessons = course.lessons?.length || 0;
          const percent = totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0;

          return (
            <Link key={course.id} href={`/academy/${course.slug}`} className="card hover:border-brand-500 transition-colors group">
              <div className={cn('h-2 rounded-full mb-3 bg-gradient-to-r', CATEGORY_COLORS[course.category] || 'from-gray-500 to-gray-700')} />

              {course.thumbnail && (
                <img src={course.thumbnail} alt={course.title} className="w-full h-32 object-cover rounded-lg mb-3" />
              )}

              <span className="text-xs text-brand-400 capitalize">{course.category.replace(/-/g, ' ')}</span>
              <h2 className="font-bold mt-1 group-hover:text-brand-400 transition-colors">{course.title}</h2>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{course.description}</p>

              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-gray-500">{totalLessons} lessons</span>
                {prog && (
                  <span className={cn('font-bold', prog.completedAt ? 'text-accent-green' : 'text-brand-400')}>
                    {prog.completedAt ? 'Completed' : `${completedCount}/${totalLessons}`}
                  </span>
                )}
              </div>

              {prog && !prog.completedAt && (
                <div className="mt-2 w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${percent}%` }} />
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* CTA */}
      <div className="text-center py-6">
        <p className="text-gray-400 text-sm mb-3">Ready to put your knowledge to the test?</p>
        <Link href="/sports/football" className="btn-primary px-8">Go to Sportsbook</Link>
      </div>
    </div>
  );
}
