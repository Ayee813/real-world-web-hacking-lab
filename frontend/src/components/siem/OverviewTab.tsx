import { useEffect, useState } from 'react';
import { Activity, ShieldAlert, FolderOpen, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import type { StatsResponse } from './types';
import { Card, StatTile } from './ui';
import { EventsAreaChart, SeverityDonutChart, TopNBarChart } from './charts';

const RANGES = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

export default function OverviewTab() {
  const [range, setRange] = useState('24h');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get<StatsResponse>(`/siem/stats?range=${range}`)
      .then(setStats)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [range]);

  if (loading) return <div className="text-center py-20 text-gray-400 text-sm">Loading dashboard...</div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>;
  if (!stats) return null;

  const openAlerts = stats.alert_counts.filter(a => a.status === 'open').reduce((s, a) => s + a.c, 0);
  const criticalHighAlerts = stats.alert_counts
    .filter(a => a.status === 'open' && (a.severity === 'critical' || a.severity === 'high'))
    .reduce((s, a) => s + a.c, 0);
  const openCases = stats.case_counts.filter(c => c.status !== 'closed').reduce((s, c) => s + c.c, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-1">
        {RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              range === r.value ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total Events" value={stats.total_events} icon={<Activity size={18} />} />
        <StatTile label="Open Alerts" value={openAlerts} icon={<ShieldAlert size={18} />} accent="text-red-500" />
        <StatTile label="Critical / High" value={criticalHighAlerts} icon={<AlertTriangle size={18} />} accent="text-orange-500" />
        <StatTile label="Open Cases" value={openCases} icon={<FolderOpen size={18} />} accent="text-amber-500" />
      </div>

      <Card title="Events over time">
        <EventsAreaChart data={stats.events_over_time} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Severity breakdown">
          <SeverityDonutChart data={stats.severity_breakdown} />
        </Card>
        <Card title="Top event types">
          <TopNBarChart items={stats.top_event_types} getLabel={e => e.event_type} getValue={e => e.c} color="#16a34a" />
        </Card>
        <Card title="Top source IPs">
          <TopNBarChart items={stats.top_source_ips} getLabel={i => i.source_ip} getValue={i => i.c} color="#3b82f6" />
        </Card>
        <Card title="Most targeted / active users">
          <TopNBarChart items={stats.top_targeted_users} getLabel={u => u.username} getValue={u => u.c} color="#a855f7" />
        </Card>
      </div>
    </div>
  );
}
