import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, User, ArrowLeft, Globe, Lock } from 'lucide-react';
import Navbar from '../components/Navbar';
import { api } from '../lib/api';
import { getUser } from '../lib/auth';

interface Article {
  id: string;
  title: string;
  body: string;
  is_public: boolean;
  created_at: string;
  author: string;
  author_id: string;
}

export default function ArticleView() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get<Article>(`/article/${id}`)
      .then(setArticle)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-600 mb-8 transition-colors"
        >
          <ArrowLeft size={15} />
          Back to articles
        </Link>

        {loading && (
          <div className="text-center py-20 text-gray-400 text-sm">Loading...</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {article && (() => {
          const currentUser = getUser();
          const isOwner = currentUser?.id === article.author_id;
          const canRead = article.is_public || isOwner;

          return (
            <article className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  {article.is_public ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                      <Globe size={11} />
                      Public
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
                      <Lock size={11} />
                      Private
                    </span>
                  )}
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-4">{article.title}</h1>

                <div className="flex items-center gap-4 text-sm text-gray-400 pb-6 border-b border-gray-100">
                  <span className="flex items-center gap-1.5">
                    <User size={14} />
                    {article.author}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} />
                    {new Date(article.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {canRead ? (
                // INTENTIONAL VULN: dangerouslySetInnerHTML — no sanitization, enables stored XSS
                <div
                  className="prose prose-gray max-w-none text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: article.body }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                  <Lock size={32} className="text-gray-300" />
                  <p className="text-gray-500 font-medium">This article is private</p>
                  <p className="text-gray-400 text-sm">Only the author can view its content.</p>
                </div>
              )}
            </article>
          );
        })()}
      </main>
    </div>
  );
}
