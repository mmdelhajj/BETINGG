'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function BlogPostPage() {
  const { slug } = useParams();
  const [post, setPost] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get(`/blog/posts/${slug}`).then(({ data }) => {
      setPost(data.data);
      // Fetch related
      if (data.data?.id) {
        api.get(`/blog/posts/${data.data.id}/related`).then(({ data: relData }) => {
          setRelated(relData.data || []);
        }).catch(() => {});
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [slug]);

  if (isLoading) return <div className="max-w-3xl mx-auto"><div className="card h-96 animate-pulse bg-surface-tertiary" /></div>;
  if (!post) return <div className="max-w-3xl mx-auto text-center py-20"><h1 className="text-xl font-bold">Post not found</h1></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/blog" className="text-sm text-brand-400 hover:underline">&larr; Back to Blog</Link>

      <article>
        {post.featuredImage && (
          <img src={post.featuredImage} alt={post.title} className="w-full h-64 object-cover rounded-xl mb-6" />
        )}

        <span className="text-xs text-brand-400 uppercase">{post.category}</span>
        <h1 className="text-3xl font-bold mt-1 mb-3">{post.title}</h1>

        <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
          <div className="flex items-center gap-2">
            {post.authorAvatar && <img src={post.authorAvatar} alt="" className="w-6 h-6 rounded-full" />}
            <span>{post.authorName}</span>
          </div>
          <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}</span>
        </div>

        {post.tags?.length > 0 && (
          <div className="flex gap-2 mb-6">
            {post.tags.map((tag: string) => (
              <span key={tag} className="text-xs bg-surface-tertiary rounded-full px-3 py-1 text-gray-400">{tag}</span>
            ))}
          </div>
        )}

        {/* Post Content (Markdown rendered as HTML) */}
        <div className="prose prose-invert prose-sm max-w-none">
          <div dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '<br/>') }} />
        </div>
      </article>

      {/* Related Posts */}
      {related.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-3">Related Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {related.map((r) => (
              <Link key={r.id} href={`/blog/${r.slug}`} className="card hover:border-brand-500 transition-colors">
                <span className="text-xs text-brand-400 uppercase">{r.category}</span>
                <h3 className="font-bold text-sm mt-1">{r.title}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
