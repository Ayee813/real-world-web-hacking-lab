import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, User, Lock, Globe, FileText } from 'lucide-react';
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

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <Link
      key={article.id}
      to={`/articles/${article.id}`}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:border-green-400 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900 group-hover:text-green-700 transition-colors line-clamp-2 flex-1">
          {article.title}
        </h2>
        {article.is_public ? (
          <Globe size={14} className="text-green-500 ml-2 mt-0.5 shrink-0" />
        ) : (
          <Lock size={14} className="text-gray-400 ml-2 mt-0.5 shrink-0" />
        )}
      </div>

      <p className="text-gray-500 text-sm line-clamp-3 mb-4">
        {stripHtml(article.body)}
      </p>

      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <User size={12} />
          {article.author}
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {new Date(article.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
        {!article.is_public && (
          <span className="flex items-center gap-1 text-amber-500">
            <Lock size={11} />
            Private
          </span>
        )}
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const [publicArticles, setPublicArticles] = useState<Article[]>([]);
  const [myArticles, setMyArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentUser = getUser();

  useEffect(() => {
    Promise.all([
      api.get<Article[]>('/articles?public=true'),
      api.get<Article[]>('/articles/mine'),
    ])
      .then(([pub, mine]) => {
        setPublicArticles(pub);
        setMyArticles(mine);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const myPrivateArticles = myArticles.filter(a => !a.is_public);
  const publicExcludingMine = publicArticles.filter(
    a => a.author_id !== currentUser?.id
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <span className="text-sm">Loading articles...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-6">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {myArticles.length > 0 && (
              <section className="mb-10">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">My Articles</h2>
                    <p className="text-gray-500 text-sm mt-0.5">Your public and private write-ups</p>
                  </div>
                  <Link
                    to="/articles/new"
                    className="text-sm text-green-600 hover:text-green-700 font-medium"
                  >
                    + New article
                  </Link>
                </div>

                {myPrivateArticles.length > 0 && (
                  <div className="mb-4 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 w-fit">
                    <Lock size={12} />
                    You have {myPrivateArticles.length} private article{myPrivateArticles.length > 1 ? 's' : ''} — only you can read {myPrivateArticles.length > 1 ? 'them' : 'it'}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {myArticles.map(article => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="mb-5">
                <h2 className="text-xl font-bold text-gray-900">Community Articles</h2>
                <p className="text-gray-500 text-sm mt-0.5">Public write-ups from other members</p>
              </div>

              {publicExcludingMine.length === 0 && myArticles.length === 0 && (
                <div className="text-center py-20">
                  <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">No articles yet.</p>
                  <Link
                    to="/articles/new"
                    className="inline-block mt-4 text-sm text-green-600 hover:text-green-700 font-medium"
                  >
                    Write the first one
                  </Link>
                </div>
              )}

              {publicExcludingMine.length === 0 && myArticles.length > 0 && (
                <p className="text-gray-400 text-sm">No articles from other members yet.</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {publicExcludingMine.map(article => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
