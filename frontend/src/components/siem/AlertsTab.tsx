import { useEffect, useState } from 'react';
import { X, CheckCircle2, Eye } from 'lucide-react';
import { api } from '../../lib/api';
import type { SiemAlert, SiemCase } from './types';
import { SeverityBadge, StatusBadge, EmptyState, formatTs, Card } from './ui';

export default function AlertsTab() {
  const [status, setStatus] = useState('open');
  const [alerts, setAlerts] = useState<SiemAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SiemAlert | null>(null);
  const [cases, setCases] = useState<SiemCase[]>([]);

  function load() {
    setLoading(true);
    const qs = status ? `?status=${status}` : '';
    api.get<SiemAlert[]>(`/siem/alerts${qs}`)
      .then(setAlerts)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [status]);
  useEffect(() => {
    api.get<SiemCase[]>('/siem/cases?status=open').then(setCases).catch(() => {});
  }, []);

  async function updateStatus(alert: SiemAlert, newStatus: string) {
    const updated = await api.patch<SiemAlert>(`/siem/alerts/${alert.id}`, { status: newStatus });
    setAlerts(prev => prev.map(a => (a.id === alert.id ? updated : a)));
    if (selected?.id === alert.id) setSelected({ ...selected, ...updated });
  }

  async function attachToCase(alert: SiemAlert, caseId: string) {
    const updated = await api.patch<SiemAlert>(`/siem/alerts/${alert.id}`, { case_id: caseId });
    setAlerts(prev => prev.map(a => (a.id === alert.id ? updated : a)));
    if (selected?.id === alert.id) setSelected({ ...selected, ...updated });
  }

  async function openDetail(alert: SiemAlert) {
    const detail = await api.get<SiemAlert>(`/siem/alerts/${alert.id}`);
    setSelected(detail);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {['', 'open', 'acknowledged', 'resolved'].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
              status === s ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <Card><EmptyState label="No alerts match this filter." /></Card>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div key={alert.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <SeverityBadge severity={alert.severity} />
                  <StatusBadge status={alert.status} />
                  <span className="text-xs text-gray-400 font-mono">{alert.rule_id}</span>
                </div>
                <h4 className="font-semibold text-gray-900 text-sm">{alert.title}</h4>
                <p className="text-gray-500 text-sm mt-0.5">{alert.description}</p>
                <div className="text-xs text-gray-400 mt-2 flex items-center gap-3 flex-wrap">
                  <span>{formatTs(alert.created_at)}</span>
                  {alert.source_ip && <span>IP: {alert.source_ip}</span>}
                  {alert.target_username && <span>User: {alert.target_username}</span>}
                  {alert.log_ids?.length > 0 && <span>{alert.log_ids.length} linked event(s)</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => openDetail(alert)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <Eye size={12} /> View
                </button>
                {alert.status === 'open' && (
                  <button
                    onClick={() => updateStatus(alert, 'acknowledged')}
                    className="px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-200 bg-amber-50 rounded-lg hover:bg-amber-100"
                  >
                    Acknowledge
                  </button>
                )}
                {alert.status !== 'resolved' && (
                  <button
                    onClick={() => updateStatus(alert, 'resolved')}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100"
                  >
                    <CheckCircle2 size={12} /> Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-end z-50" onClick={() => setSelected(null)}>
          <div className="bg-white w-full max-w-lg h-full overflow-y-auto p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Alert detail</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-sm mb-6">
              <div className="flex gap-2"><SeverityBadge severity={selected.severity} /><StatusBadge status={selected.status} /></div>
              <div className="font-semibold text-gray-900">{selected.title}</div>
              <p className="text-gray-500">{selected.description}</p>
              <div className="text-xs text-gray-400">Created {formatTs(selected.created_at)}</div>
              {selected.resolved_at && <div className="text-xs text-gray-400">Resolved {formatTs(selected.resolved_at)}</div>}

              <div className="flex items-center gap-2 pt-2">
                <label className="text-xs text-gray-500">Attach to case:</label>
                <select
                  value={selected.case_id ?? ''}
                  onChange={e => e.target.value && attachToCase(selected, e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1"
                >
                  <option value="">None</option>
                  {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
            </div>

            <h4 className="text-sm font-semibold text-gray-900 mb-2">Linked events ({selected.logs?.length ?? 0})</h4>
            <div className="space-y-2">
              {(selected.logs ?? []).map(log => (
                <div key={log.id} className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-gray-600">{log.event_type}</span>
                    <span className="text-gray-400">{formatTs(log.ts)}</span>
                  </div>
                  <div className="text-gray-600">{log.message}</div>
                </div>
              ))}
              {(!selected.logs || selected.logs.length === 0) && <EmptyState label="No linked events." />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
