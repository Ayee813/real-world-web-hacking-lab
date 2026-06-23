import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, User, Lock, Globe, FileText } from 'lucide-react';
import Navbar from '../components/Navbar';
import { api } from '../lib/api';

interface Article {
  id: string;
  title: string;
  body: string;
  is_public: boolean;
  created_at: string;
  author: string;
}

export default function Dashboard() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Article[]>('/articles?public=true')
      .then(setArticles)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function stripHtml(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Latest Articles</h1>
          <p className="text-gray-500 text-sm mt-1">Public write-ups from the community</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <span className="text-sm">Loading articles...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && articles.length === 0 && (
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {articles.map(article => (
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
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
