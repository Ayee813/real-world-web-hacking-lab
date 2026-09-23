export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface SiemLog {
  id: string;
  ts: string;
  event_type: string;
  severity: Severity;
  source_ip: string | null;
  method: string | null;
  path: string | null;
  status_code: number | null;
  user_id: string | null;
  username: string | null;
  message: string;
  metadata: Record<string, unknown>;
}

export interface SiemAlert {
  id: string;
  rule_id: string;
  title: string;
  description: string;
  severity: Severity;
  status: 'open' | 'acknowledged' | 'resolved';
  source_ip: string | null;
  user_id: string | null;
  target_username?: string | null;
  log_ids: string[];
  case_id: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  logs?: SiemLog[];
}

export interface SiemCase {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'investigating' | 'closed';
  severity: Severity;
  assigned_to: string | null;
  assignee_username?: string | null;
  created_by: string | null;
  creator_username?: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  alert_count?: number;
  alerts?: SiemAlert[];
  notes?: SiemCaseNote[];
}

export interface SiemCaseNote {
  id: string;
  case_id: string;
  author_id: string;
  author_username?: string;
  note: string;
  created_at: string;
}

export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  enabled: boolean;
}

export interface ThreatIntelEntry {
  id: string;
  type: 'ip' | 'pattern';
  value: string;
  description: string | null;
  severity: Severity;
  created_at: string;
}

export interface StatsResponse {
  range: string;
  total_events: number;
  severity_breakdown: { severity: Severity; c: number }[];
  events_over_time: { bucket: string; c: number }[];
  top_event_types: { event_type: string; c: number }[];
  top_source_ips: { source_ip: string; c: number }[];
  top_targeted_users: { username: string; user_id: string; c: number }[];
  alert_counts: { status: string; severity: Severity; c: number }[];
  case_counts: { status: string; c: number }[];
}

export interface ReportResponse {
  range: { from: string; to: string };
  total_events: number;
  severity_breakdown: { severity: Severity; c: number }[];
  event_type_breakdown: { event_type: string; c: number }[];
  alerts_created: number;
  alerts_resolved: number;
  cases_opened: number;
  cases_closed: number;
  top_source_ips: { source_ip: string; c: number }[];
  top_targeted_users: { username: string; c: number }[];
}
