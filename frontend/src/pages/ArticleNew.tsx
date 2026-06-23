import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bold, Italic, Underline, Heading1, Globe, Lock, Loader2, Send
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { api } from '../lib/api';

type ToolbarCommand = 'bold' | 'italic' | 'underline' | 'formatBlock';

export default function ArticleNew() {
  const navigate = useNavigate();
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function execCmd(cmd: ToolbarCommand, value?: string) {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  }

  async function handleSubmit() {
    const body = editorRef.current?.innerHTML?.trim() ?? '';
    if (!title.trim()) { setError('Title is required'); return; }
    if (!body || body === '<br>') { setError('Body cannot be empty'); return; }

    setError('');
    setLoading(true);
    try {
      const article = await api.post<{ id: string }>('/articles', {
        title: title.trim(),
        body,
        is_public: isPublic,
      });
      navigate(`/articles/${article.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to publish');
    } finally {
      setLoading(false);
    }
  }

  const toolbarBtn = (onClick: () => void, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      title={label}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
    >
      {icon}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">New Article</h1>
          <p className="text-gray-500 text-sm mt-1">Share your write-up with the community</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Article title"
              className="w-full text-xl font-semibold text-gray-900 placeholder-gray-300 border-0 outline-none bg-transparent"
            />
          </div>

          <div className="border-b border-gray-100 px-3 py-1.5 flex items-center gap-0.5 bg-gray-50">
            {toolbarBtn(() => execCmd('bold'), 'Bold', <Bold size={15} />)}
            {toolbarBtn(() => execCmd('italic'), 'Italic', <Italic size={15} />)}
            {toolbarBtn(() => execCmd('underline'), 'Underline', <Underline size={15} />)}
            <div className="w-px h-5 bg-gray-200 mx-1" />
            {toolbarBtn(() => execCmd('formatBlock', '<h1>'), 'Heading 1', <Heading1 size={15} />)}
          </div>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Start writing your article..."
            className="min-h-64 p-6 text-gray-700 text-sm leading-relaxed outline-none focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300"
          />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 font-medium">Visibility</span>
            <button
              type="button"
              onClick={() => setIsPublic(p => !p)}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                isPublic
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-gray-300 bg-gray-50 text-gray-500'
              }`}
            >
              {isPublic ? <Globe size={14} /> : <Lock size={14} />}
              {isPublic ? 'Public' : 'Private'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {loading ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
