'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function LessonPage() {
  const { courseSlug, lessonSlug } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get(`/academy/courses/${courseSlug}/lessons/${lessonSlug}`).then(({ data: res }) => {
      setData(res.data);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [courseSlug, lessonSlug]);

  const completeLesson = async () => {
    if (!data) return;
    await api.post('/academy/progress/complete-lesson', {
      courseId: data.course.id,
      lessonId: data.lesson.id,
      quizScore: quizScore ?? undefined,
    });
    // Navigate to next lesson or back to course
    const lessons = data.course.lessons;
    if (lessons) {
      const currentIdx = lessons.findIndex((l: any) => l.id === data.lesson.id);
      if (currentIdx < lessons.length - 1) {
        router.push(`/academy/${courseSlug}/${lessons[currentIdx + 1].slug}`);
        return;
      }
    }
    router.push(`/academy/${courseSlug}`);
  };

  const submitQuiz = () => {
    const questions = data?.lesson?.quizQuestions || [];
    let correct = 0;
    questions.forEach((q: any, i: number) => {
      if (quizAnswers[i] === q.correctAnswer) correct++;
    });
    const score = Math.round((correct / questions.length) * 100);
    setQuizScore(score);
    setQuizSubmitted(true);
  };

  if (isLoading) return <div className="max-w-3xl mx-auto"><div className="card h-48 animate-pulse bg-surface-tertiary" /></div>;
  if (!data) return <div className="max-w-3xl mx-auto text-center py-20"><h1 className="text-xl font-bold">Lesson not found</h1></div>;

  const { course, lesson } = data;
  const quizQuestions = lesson.quizQuestions || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/academy" className="text-brand-400 hover:underline">Academy</Link>
        <span className="text-gray-600">/</span>
        <Link href={`/academy/${courseSlug}`} className="text-brand-400 hover:underline">{course.title}</Link>
        <span className="text-gray-600">/</span>
        <span className="text-gray-400">{lesson.title}</span>
      </div>

      {/* Lesson Content */}
      <article className="card">
        <h1 className="text-2xl font-bold mb-4">{lesson.title}</h1>
        <div className="prose prose-invert prose-sm max-w-none">
          <div dangerouslySetInnerHTML={{ __html: lesson.content.replace(/\n/g, '<br/>') }} />
        </div>
      </article>

      {/* Quiz */}
      {quizQuestions.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-bold mb-4">Quiz</h2>
          <div className="space-y-4">
            {quizQuestions.map((q: any, qi: number) => (
              <div key={qi}>
                <p className="text-sm font-medium mb-2">{qi + 1}. {q.question}</p>
                <div className="space-y-1">
                  {q.options.map((opt: string, oi: number) => {
                    const isSelected = quizAnswers[qi] === oi;
                    const isCorrect = quizSubmitted && oi === q.correctAnswer;
                    const isWrong = quizSubmitted && isSelected && oi !== q.correctAnswer;

                    return (
                      <button
                        key={oi}
                        onClick={() => !quizSubmitted && setQuizAnswers(prev => ({ ...prev, [qi]: oi }))}
                        disabled={quizSubmitted}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                          isCorrect ? 'bg-accent-green/20 text-accent-green border border-accent-green/30' :
                          isWrong ? 'bg-accent-red/20 text-accent-red border border-accent-red/30' :
                          isSelected ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' :
                          'bg-surface-tertiary text-gray-300 hover:bg-surface-hover'
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {!quizSubmitted ? (
            <button
              onClick={submitQuiz}
              disabled={Object.keys(quizAnswers).length < quizQuestions.length}
              className="btn-primary mt-4"
            >
              Submit Quiz
            </button>
          ) : (
            <div className="mt-4 p-3 bg-surface-tertiary rounded-lg text-center">
              <p className="text-lg font-bold">Score: <span className={cn(quizScore! >= 70 ? 'text-accent-green' : 'text-accent-yellow')}>{quizScore}%</span></p>
              <p className="text-xs text-gray-500 mt-1">{quizScore! >= 70 ? 'Great job!' : 'Review the material and try again.'}</p>
            </div>
          )}
        </div>
      )}

      {/* Complete & Next */}
      <div className="flex justify-between">
        <Link href={`/academy/${courseSlug}`} className="btn-secondary">Back to Course</Link>
        <button onClick={completeLesson} className="btn-primary">
          {quizQuestions.length > 0 && !quizSubmitted ? 'Skip & Complete' : 'Complete & Continue'}
        </button>
      </div>
    </div>
  );
}
