import { useState } from 'react';
import { Printer, Download } from 'lucide-react';
import { api } from '../../lib/api';
import { getToken } from '../../lib/auth';
import type { ReportResponse } from './types';
import { Card, StatTile } from './ui';
import { SeverityDonutChart, TopNBarChart } from './charts';

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

export default function ReportsTab() {
  const [from, setFrom] = useState(isoDaysAgo(7));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function generate() {
    setLoading(true);
    setError('');
    api.get<ReportResponse>(`/siem/report?from=${from}T00:00:00.000Z&to=${to}T23:59:59.999Z`)
      .then(setReport)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function exportCsv() {
    const token = getToken();
    const params = new URLSearchParams({ from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z` });
    const res = await fetch(`/api/siem/logs/export?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `siem_report_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
        </div>
        <button onClick={generate} className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">
          Generate report
        </button>
        {report && (
          <>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              <Printer size={14} /> Print / Save PDF
            </button>
            <button onClick={exportCsv} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              <Download size={14} /> Export raw logs (CSV)
            </button>
          </>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>}
      {loading && <div className="text-center py-16 text-gray-400 text-sm">Building report...</div>}

      {report && (
        <div className="space-y-6">
          <div className="text-sm text-gray-500">
            Report period: <span className="font-medium text-gray-700">{from}</span> to <span className="font-medium text-gray-700">{to}</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Total events" value={report.total_events} icon={null} />
            <StatTile label="Alerts created" value={report.alerts_created} icon={null} />
            <StatTile label="Alerts resolved" value={report.alerts_resolved} icon={null} />
            <StatTile label="Cases opened / closed" value={`${report.cases_opened} / ${report.cases_closed}`} icon={null} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Severity breakdown">
              <SeverityDonutChart data={report.severity_breakdown} />
            </Card>
            <Card title="Event types">
              <TopNBarChart items={report.event_type_breakdown} getLabel={e => e.event_type} getValue={e => e.c} color="#16a34a" />
            </Card>
            <Card title="Top source IPs">
              <TopNBarChart items={report.top_source_ips} getLabel={i => i.source_ip} getValue={i => i.c} color="#3b82f6" />
            </Card>
            <Card title="Most active users">
              <TopNBarChart items={report.top_targeted_users} getLabel={u => u.username} getValue={u => u.c} color="#a855f7" />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
