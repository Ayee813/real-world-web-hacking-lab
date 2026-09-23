import { useEffect, useState } from 'react';
import { Search, Download, X } from 'lucide-react';
import { api } from '../../lib/api';
import { getToken } from '../../lib/auth';
import type { SiemLog, Severity } from './types';
import { SeverityBadge, EmptyState, formatTs } from './ui';

const SEVERITIES: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];
const PAGE_SIZE = 25;

export default function LogsTab() {
  const [q, setQ] = useState('');
  const [severity, setSeverity] = useState('');
  const [eventType, setEventType] = useState('');
  const [offset, setOffset] = useState(0);
  const [logs, setLogs] = useState<SiemLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SiemLog | null>(null);

  function buildQuery(withOffset: number): string {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (severity) params.set('severity', severity);
    if (eventType) params.set('event_type', eventType);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(withOffset));
    return params.toString();
  }

  useEffect(() => {
    setLoading(true);
    api.get<{ total: number; logs: SiemLog[] }>(`/siem/logs?${buildQuery(offset)}`)
      .then(res => {
        setLogs(res.logs);
        setTotal(res.total);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  function runSearch() {
    setOffset(0);
    setLoading(true);
    api.get<{ total: number; logs: SiemLog[] }>(`/siem/logs?${buildQuery(0)}`)
      .then(res => {
        setLogs(res.logs);
        setTotal(res.total);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function exportCsv() {
    const token = getToken();
    const params = new URLSearchParams();
    if (severity) params.set('severity', severity);
    if (eventType) params.set('event_type', eventType);
    const res = await fetch(`/api/siem/logs/export?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `siem_logs_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runSearch()}
            placeholder="Search message, path, username..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <select
          value={severity}
          onChange={e => setSeverity(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All severities</option>
          {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          value={eventType}
          onChange={e => setEventType(e.target.value)}
          placeholder="event_type"
          className="w-40 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={runSearch}
          className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Search
        </button>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading logs...</div>
        ) : logs.length === 0 ? (
          <EmptyState label="No log events match these filters." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Severity</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Source IP</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr
                  key={log.id}
                  onClick={() => setSelected(log)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{formatTs(log.ts)}</td>
                  <td className="px-4 py-2.5"><SeverityBadge severity={log.severity} /></td>
                  <td className="px-4 py-2.5 text-gray-700 font-mono text-xs">{log.event_type}</td>
                  <td className="px-4 py-2.5 text-gray-500">{log.source_ip ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{log.username ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{total} total events — page {page} of {pageCount}</span>
          <div className="flex gap-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-end z-50" onClick={() => setSelected(null)}>
          <div
            className="bg-white w-full max-w-md h-full overflow-y-auto p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Log detail</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div><span className="text-gray-400">Time:</span> {formatTs(selected.ts)}</div>
              <div><span className="text-gray-400">Severity:</span> <SeverityBadge severity={selected.severity} /></div>
              <div><span className="text-gray-400">Event type:</span> <span className="font-mono text-xs">{selected.event_type}</span></div>
              <div><span className="text-gray-400">Message:</span> {selected.message}</div>
              <div><span className="text-gray-400">Source IP:</span> {selected.source_ip ?? '—'}</div>
              <div><span className="text-gray-400">User:</span> {selected.username ?? selected.user_id ?? '—'}</div>
              {selected.method && <div><span className="text-gray-400">Method:</span> {selected.method}</div>}
              {selected.path && <div><span className="text-gray-400">Path:</span> <span className="font-mono text-xs break-all">{selected.path}</span></div>}
              {selected.status_code !== null && <div><span className="text-gray-400">Status:</span> {selected.status_code}</div>}
              <div>
                <span className="text-gray-400">Metadata:</span>
                <pre className="mt-1 bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs overflow-x-auto">
                  {JSON.stringify(selected.metadata, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
