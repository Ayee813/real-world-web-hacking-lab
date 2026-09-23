import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import type { Severity } from './types';
import { EmptyState } from './ui';

export const SEVERITY_HEX: Record<Severity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#3b82f6',
  info: '#94a3b8',
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      {label !== undefined && <div className="font-medium text-gray-700 mb-1">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5 text-gray-500">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color ?? p.fill }} />
          <span className="capitalize">{p.name}:</span>
          <span className="font-semibold text-gray-800 tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function formatBucketLabel(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
}

export function EventsAreaChart({ data }: { data: { bucket: string; c: number }[] }) {
  if (data.length === 0) return <EmptyState label="No events in this range" />;
  const chartData = data.map(d => ({ bucket: formatBucketLabel(d.bucket), count: d.c }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="siemEventsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} minTickGap={24} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
        <Tooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey="count" name="Events" stroke="#16a34a" strokeWidth={2} fill="url(#siemEventsGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SeverityDonutChart({ data }: { data: { severity: Severity; c: number }[] }) {
  if (data.length === 0) return <EmptyState label="No data" />;
  const total = data.reduce((s, d) => s + d.c, 0);
  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie data={data} dataKey="c" nameKey="severity" innerRadius={42} outerRadius={62} paddingAngle={2} strokeWidth={0}>
            {data.map((entry, i) => (
              <Cell key={i} fill={SEVERITY_HEX[entry.severity] ?? SEVERITY_HEX.info} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2 text-sm flex-1 min-w-0">
        {data
          .slice()
          .sort((a, b) => b.c - a.c)
          .map(d => (
            <div key={d.severity} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-gray-600 capitalize">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SEVERITY_HEX[d.severity] ?? SEVERITY_HEX.info }} />
                {d.severity}
              </span>
              <span className="text-gray-800 font-semibold tabular-nums">{d.c}</span>
            </div>
          ))}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100 text-xs text-gray-400">
          <span>Total</span>
          <span className="font-medium">{total}</span>
        </div>
      </div>
    </div>
  );
}

export function TopNBarChart<T>({
  items,
  getLabel,
  getValue,
  color = '#16a34a',
}: {
  items: T[];
  getLabel: (item: T) => string;
  getValue: (item: T) => number;
  color?: string;
}) {
  if (items.length === 0) return <EmptyState label="No data" />;
  const data = items.map(item => ({ label: getLabel(item), value: getValue(item) }));
  const height = Math.max(data.length * 34, 60);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 12, fill: '#4b5563' }}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Bar dataKey="value" name="Count" fill={color} radius={[0, 4, 4, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  );
}
