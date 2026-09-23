import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getUser } from '../../lib/auth';
import type { DetectionRule } from './types';
import { SeverityBadge, EmptyState } from './ui';

export default function RulesTab() {
  const isAdmin = getUser()?.role === 'admin';
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<DetectionRule[]>('/siem/rules')
      .then(setRules)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(rule: DetectionRule) {
    if (!isAdmin) return;
    const updated = await api.patch<DetectionRule>(`/siem/rules/${rule.id}`, { enabled: !rule.enabled });
    setRules(prev => prev.map(r => (r.id === rule.id ? updated : r)));
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Loading rules...</div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>;

  return (
    <div className="space-y-3">
      {!isAdmin && (
        <div className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          Only admins can enable or disable detection rules.
        </div>
      )}
      {rules.length === 0 && <EmptyState label="No detection rules configured." />}
      {rules.map(rule => (
        <div key={rule.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 text-sm">{rule.name}</span>
              <SeverityBadge severity={rule.severity} />
              <span className="text-xs text-gray-400 font-mono">{rule.id}</span>
            </div>
            <p className="text-gray-500 text-sm">{rule.description}</p>
          </div>
          <button
            onClick={() => toggle(rule)}
            disabled={!isAdmin}
            className={`shrink-0 relative w-11 h-6 rounded-full transition-colors ${rule.enabled ? 'bg-green-600' : 'bg-gray-300'} ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${rule.enabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      ))}
    </div>
  );
}
