import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import type { SiemLog } from './types';
import { Card, EmptyState, formatTs } from './ui';

export default function SettingsTab() {
  const isAdmin = getUser()?.role === 'admin';
  const [retentionDays, setRetentionDays] = useState('30');
  const [saving, setSaving] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);
  const [audit, setAudit] = useState<SiemLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Record<string, string>>('/siem/settings').then(s => {
      if (s.retention_days) setRetentionDays(s.retention_days);
    });
    api.get<SiemLog[]>('/siem/audit').then(setAudit).finally(() => setLoading(false));
  }, []);

  async function saveRetention() {
    setSaving(true);
    try {
      await api.put('/siem/settings', { retention_days: parseInt(retentionDays, 10) });
    } finally {
      setSaving(false);
    }
  }

  async function purgeNow() {
    setPurgeResult(null);
    const result = await api.post<{ deleted: number; retention_days: number }>('/siem/retention/purge', {});
    setPurgeResult(`Deleted ${result.deleted} log rows older than ${result.retention_days} days.`);
  }

  return (
    <div className="space-y-6">
      <Card title="Retention policy">
        {isAdmin ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Keep logs for (days)</label>
              <input
                type="number"
                min={1}
                value={retentionDays}
                onChange={e => setRetentionDays(e.target.value)}
                className="w-28 px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            <button
              onClick={saveRetention}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={purgeNow}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100"
            >
              <Trash2 size={14} /> Purge now
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Current retention: {retentionDays} days. Only admins can change this.</p>
        )}
        {purgeResult && <p className="text-xs text-gray-500 mt-3">{purgeResult}</p>}
      </Card>

      <Card title="SIEM admin audit trail">
        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
        ) : audit.length === 0 ? (
          <EmptyState label="No admin actions recorded yet." />
        ) : (
          <div className="space-y-2">
            {audit.map(entry => (
              <div key={entry.id} className="flex items-start justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                <div>
                  <span className="text-gray-700">{entry.message}</span>
                  <span className="text-gray-400 ml-2">by {entry.username ?? entry.user_id ?? 'unknown'}</span>
                </div>
                <span className="text-xs text-gray-400 shrink-0 ml-3">{formatTs(entry.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
