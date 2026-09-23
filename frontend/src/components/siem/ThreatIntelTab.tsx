import { useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import type { ThreatIntelEntry, Severity } from './types';
import { SeverityBadge, EmptyState, Card, formatTs } from './ui';

export default function ThreatIntelTab() {
  const isAdmin = getUser()?.role === 'admin';
  const [entries, setEntries] = useState<ThreatIntelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [type, setType] = useState<'ip' | 'pattern'>('ip');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>('high');

  function load() {
    setLoading(true);
    api.get<ThreatIntelEntry[]>('/siem/threat-intel')
      .then(setEntries)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function addEntry() {
    if (!value.trim()) return;
    const created = await api.post<ThreatIntelEntry>('/siem/threat-intel', { type, value, description, severity });
    setEntries(prev => [created, ...prev.filter(e => e.id !== created.id)]);
    setValue('');
    setDescription('');
  }

  async function removeEntry(id: string) {
    await api.delete(`/siem/threat-intel/${id}`);
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  return (
    <div className="space-y-4">
      {isAdmin && (
        <Card title="Add indicator">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select value={type} onChange={e => setType(e.target.value as 'ip' | 'pattern')} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
                <option value="ip">IP address</option>
                <option value="pattern">Text pattern</option>
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-gray-500 mb-1">Value</label>
              <input
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={type === 'ip' ? '203.0.113.42' : "' OR '1'='1"}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Why this is known-bad"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Severity</label>
              <select value={severity} onChange={e => setSeverity(e.target.value as Severity)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
                {(['low', 'medium', 'high', 'critical'] as Severity[]).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button onClick={addEntry} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Plus size={14} /> Add
            </button>
          </div>
        </Card>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading indicators...</div>
        ) : entries.length === 0 ? (
          <EmptyState label="No threat intel indicators yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Value</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Severity</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Added</th>
                {isAdmin && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-500 capitalize">{entry.type}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{entry.value}</td>
                  <td className="px-4 py-2.5 text-gray-500">{entry.description ?? '—'}</td>
                  <td className="px-4 py-2.5"><SeverityBadge severity={entry.severity} /></td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{formatTs(entry.created_at)}</td>
                  {isAdmin && (
                    <td className="px-4 py-2.5">
                      <button onClick={() => removeEntry(entry.id)} className="text-gray-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
