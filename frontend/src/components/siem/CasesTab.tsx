import { useEffect, useState } from 'react';
import { X, Plus, Send } from 'lucide-react';
import { api } from '../../lib/api';
import type { SiemCase, Severity } from './types';
import { SeverityBadge, StatusBadge, EmptyState, formatTs, Card } from './ui';

export default function CasesTab() {
  const [cases, setCases] = useState<SiemCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SiemCase | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [noteText, setNoteText] = useState('');

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newSeverity, setNewSeverity] = useState<Severity>('medium');

  function load() {
    setLoading(true);
    api.get<SiemCase[]>('/siem/cases')
      .then(setCases)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    api.get<SiemCase>(`/siem/cases/${selectedId}`).then(setDetail);
  }, [selectedId]);

  async function createCase() {
    if (!newTitle.trim()) return;
    const created = await api.post<SiemCase>('/siem/cases', {
      title: newTitle,
      description: newDescription || undefined,
      severity: newSeverity,
    });
    setCases(prev => [created, ...prev]);
    setNewTitle('');
    setNewDescription('');
    setNewSeverity('medium');
    setShowNew(false);
  }

  async function updateStatus(newStatus: string) {
    if (!detail) return;
    const updated = await api.patch<SiemCase>(`/siem/cases/${detail.id}`, { status: newStatus });
    setDetail({ ...detail, ...updated });
    setCases(prev => prev.map(c => (c.id === detail.id ? { ...c, ...updated } : c)));
  }

  async function addNote() {
    if (!detail || !noteText.trim()) return;
    await api.post(`/siem/cases/${detail.id}/notes`, { note: noteText });
    setNoteText('');
    const refreshed = await api.get<SiemCase>(`/siem/cases/${detail.id}`);
    setDetail(refreshed);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Plus size={14} /> New case
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading cases...</div>
      ) : cases.length === 0 ? (
        <Card><EmptyState label="No cases yet. Open one from an alert or create one directly." /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cases.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-green-400 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <SeverityBadge severity={c.severity} />
                <StatusBadge status={c.status} />
              </div>
              <h4 className="font-semibold text-gray-900 text-sm">{c.title}</h4>
              {c.description && <p className="text-gray-500 text-sm mt-1 line-clamp-2">{c.description}</p>}
              <div className="text-xs text-gray-400 mt-3 flex items-center gap-3">
                <span>{formatTs(c.created_at)}</span>
                <span>{c.alert_count ?? 0} alert(s)</span>
                {c.assignee_username && <span>Assigned: {c.assignee_username}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">New case</h3>
              <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Case title"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <textarea
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <select
                value={newSeverity}
                onChange={e => setNewSeverity(e.target.value as Severity)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {(['low', 'medium', 'high', 'critical'] as Severity[]).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                onClick={createCase}
                className="w-full py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Create case
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-end z-50" onClick={() => setSelectedId(null)}>
          <div className="bg-white w-full max-w-lg h-full overflow-y-auto p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{detail.title}</h3>
              <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <SeverityBadge severity={detail.severity} />
              <StatusBadge status={detail.status} />
            </div>
            {detail.description && <p className="text-sm text-gray-500 mb-4">{detail.description}</p>}

            <div className="flex gap-2 mb-6">
              {['open', 'investigating', 'closed'].map(s => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  disabled={detail.status === s}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border capitalize ${
                    detail.status === s
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-default'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <h4 className="text-sm font-semibold text-gray-900 mb-2">Linked alerts ({detail.alerts?.length ?? 0})</h4>
            <div className="space-y-2 mb-6">
              {(detail.alerts ?? []).map(a => (
                <div key={a.id} className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs">
                  <div className="flex items-center gap-2 mb-1"><SeverityBadge severity={a.severity} /><span className="text-gray-600 font-medium">{a.title}</span></div>
                  <div className="text-gray-400">{formatTs(a.created_at)}</div>
                </div>
              ))}
              {(!detail.alerts || detail.alerts.length === 0) && <EmptyState label="No alerts linked yet." />}
            </div>

            <h4 className="text-sm font-semibold text-gray-900 mb-2">Notes</h4>
            <div className="space-y-2 mb-3">
              {(detail.notes ?? []).map(n => (
                <div key={n.id} className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-700">{n.author_username ?? 'unknown'}</span>
                    <span className="text-gray-400">{formatTs(n.created_at)}</span>
                  </div>
                  <div className="text-gray-600">{n.note}</div>
                </div>
              ))}
              {(!detail.notes || detail.notes.length === 0) && <EmptyState label="No notes yet." />}
            </div>
            <div className="flex gap-2">
              <input
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNote()}
                placeholder="Add an investigation note..."
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button onClick={addNote} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
