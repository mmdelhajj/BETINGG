'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function HelpArticlePage() {
  const { slug } = useParams();
  const [article, setArticle] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get(`/help/articles/${slug}`).then(({ data }) => {
      setArticle(data.data);
      if (data.data?.id) {
        api.get(`/help/articles/${data.data.id}/related`).then(({ data: r }) => {
          setRelated(r.data || []);
        }).catch(() => {});
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [slug]);

  const submitFeedback = async (helpful: boolean) => {
    if (!article) return;
    await api.post(`/help/articles/${article.id}/feedback`, { helpful });
    setFeedbackSent(true);
  };

  if (isLoading) return <div className="max-w-3xl mx-auto"><div className="card h-48 animate-pulse bg-surface-tertiary" /></div>;
  if (!article) return <div className="max-w-3xl mx-auto text-center py-20"><h1 className="text-xl font-bold">Article not found</h1></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/help" className="text-sm text-brand-400 hover:underline">&larr; Back to Help Center</Link>

      <article className="card">
        <span className="text-xs text-brand-400 uppercase">{article.category}</span>
        <h1 className="text-2xl font-bold mt-1 mb-4">{article.title}</h1>

        <div className="prose prose-invert prose-sm max-w-none">
          <div dangerouslySetInnerHTML={{ __html: article.content.replace(/\n/g, '<br/>') }} />
        </div>

        {/* Tags */}
        {article.tags?.length > 0 && (
          <div className="flex gap-2 mt-6">
            {article.tags.map((tag: string) => (
              <span key={tag} className="text-xs bg-surface-tertiary rounded-full px-3 py-1 text-gray-400">{tag}</span>
            ))}
          </div>
        )}

        {/* Feedback */}
        <div className="mt-8 pt-6 border-t border-border text-center">
          {feedbackSent ? (
            <p className="text-sm text-accent-green">Thank you for your feedback!</p>
          ) : (
            <>
              <p className="text-sm text-gray-400 mb-3">Was this article helpful?</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => submitFeedback(true)} className="btn-secondary text-sm px-6">Yes</button>
                <button onClick={() => submitFeedback(false)} className="btn-secondary text-sm px-6">No</button>
              </div>
            </>
          )}
        </div>
      </article>

      {/* Related Articles */}
      {related.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2">Related Articles</h2>
          <div className="space-y-2">
            {related.map((r) => (
              <Link key={r.id} href={`/help/${r.slug}`} className="card flex items-center justify-between hover:border-brand-500/50 transition-colors">
                <span className="text-sm">{r.title}</span>
                <span className="text-gray-500">&rsaquo;</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
