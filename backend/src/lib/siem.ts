import pool from '../db';

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface LogInput {
  event_type: string;
  severity: Severity;
  source_ip?: string | null;
  method?: string | null;
  path?: string | null;
  status_code?: number | null;
  user_id?: string | null;
  username?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}

// -------------------------------------------------------------------------
// Detection rule + threat intel caches (avoid a DB round trip on every event)
// -------------------------------------------------------------------------

let ruleCache = new Map<string, boolean>();
let threatIpCache = new Set<string>();
let threatPatternCache: { value: string; description: string; severity: Severity }[] = [];

async function refreshCaches(): Promise<void> {
  try {
    const rules = await pool.query('SELECT id, enabled FROM siem_detection_rules');
    ruleCache = new Map(rules.rows.map(r => [r.id, r.enabled]));

    const intel = await pool.query('SELECT type, value, description, severity FROM siem_threat_intel');
    threatIpCache = new Set(intel.rows.filter(r => r.type === 'ip').map(r => r.value));
    threatPatternCache = intel.rows
      .filter(r => r.type === 'pattern')
      .map(r => ({ value: r.value, description: r.description, severity: r.severity }));
  } catch (err) {
    console.error('[siem] cache refresh failed', err);
  }
}

export function startSiemCaches(): void {
  refreshCaches();
  setInterval(refreshCaches, 30_000).unref();
}

export function invalidateSiemCaches(): void {
  refreshCaches();
}

function isRuleEnabled(ruleId: string): boolean {
  return ruleCache.get(ruleId) ?? true;
}

export function matchThreatIntel(ip: string | null | undefined, text: string): { severity: Severity; description: string } | null {
  if (ip && threatIpCache.has(ip)) {
    return { severity: 'high', description: `Source IP ${ip} matches a known-bad indicator` };
  }
  for (const p of threatPatternCache) {
    if (text.toLowerCase().includes(p.value.toLowerCase())) {
      return { severity: p.severity, description: p.description || `Matched threat intel pattern "${p.value}"` };
    }
  }
  return null;
}

// -------------------------------------------------------------------------
// Signature-based payload detectors
// -------------------------------------------------------------------------

const XSS_PATTERNS = [/<script[\s>]/i, /on(error|load|click|mouseover|focus)\s*=/i, /javascript:/i, /<iframe[\s>]/i, /<svg[\s>]/i];
const SQLI_PATTERNS = [/(\s|^)(union\s+select|or\s+1\s*=\s*1|'\s*or\s*')/i, /;\s*drop\s+table/i, /--\s*$/, /xp_cmdshell/i];

export function containsXss(text: string): boolean {
  return XSS_PATTERNS.some(p => p.test(text));
}

export function containsSqli(text: string): boolean {
  return SQLI_PATTERNS.some(p => p.test(text));
}

// -------------------------------------------------------------------------
// Log ingestion
// -------------------------------------------------------------------------

export async function insertLog(entry: LogInput): Promise<string> {
  const result = await pool.query(
    `INSERT INTO siem_logs (event_type, severity, source_ip, method, path, status_code, user_id, username, message, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [
      entry.event_type,
      entry.severity,
      entry.source_ip ?? null,
      entry.method ?? null,
      entry.path ?? null,
      entry.status_code ?? null,
      entry.user_id ?? null,
      entry.username ?? null,
      entry.message,
      JSON.stringify(entry.metadata ?? {}),
    ]
  );
  return result.rows[0].id;
}

// -------------------------------------------------------------------------
// Alerting (with dedup on rule + source within a short window)
// -------------------------------------------------------------------------

interface AlertInput {
  rule_id: string;
  title: string;
  description: string;
  severity: Severity;
  source_ip?: string | null;
  user_id?: string | null;
  log_id?: string | null;
}

async function upsertAlert(a: AlertInput): Promise<string | null> {
  if (!isRuleEnabled(a.rule_id)) return null;

  const dedupeMinutes = 15;
  const existing = await pool.query(
    `SELECT id FROM siem_alerts
     WHERE rule_id = $1 AND status = 'open'
       AND created_at > now() - interval '${dedupeMinutes} minutes'
       AND (source_ip IS NOT NULL AND source_ip = $2 OR user_id IS NOT NULL AND user_id = $3)
     ORDER BY created_at DESC LIMIT 1`,
    [a.rule_id, a.source_ip ?? null, a.user_id ?? null]
  );

  if (existing.rows[0]) {
    if (a.log_id) {
      await pool.query('UPDATE siem_alerts SET log_ids = array_append(log_ids, $1::uuid) WHERE id = $2', [a.log_id, existing.rows[0].id]);
    }
    return existing.rows[0].id;
  }

  const result = await pool.query(
    `INSERT INTO siem_alerts (rule_id, title, description, severity, source_ip, user_id, log_ids)
     VALUES ($1,$2,$3,$4,$5,$6, CASE WHEN $7::uuid IS NULL THEN '{}'::uuid[] ELSE ARRAY[$7::uuid] END)
     RETURNING id`,
    [a.rule_id, a.title, a.description, a.severity, a.source_ip ?? null, a.user_id ?? null, a.log_id ?? null]
  );
  return result.rows[0].id;
}

// -------------------------------------------------------------------------
// Public helper: record a security event, log it, and run its correlation rule
// -------------------------------------------------------------------------

export async function recordEvent(entry: LogInput, alert?: Omit<AlertInput, 'log_id' | 'source_ip' | 'user_id'>): Promise<void> {
  const intel = matchThreatIntel(entry.source_ip, `${entry.path ?? ''} ${entry.message} ${JSON.stringify(entry.metadata ?? {})}`);
  const finalEntry = intel
    ? { ...entry, severity: intel.severity, metadata: { ...(entry.metadata ?? {}), threat_intel_match: intel.description } }
    : entry;

  const logId = await insertLog(finalEntry);

  if (alert) {
    await upsertAlert({ ...alert, source_ip: entry.source_ip, user_id: entry.user_id, log_id: logId });
  }
  if (intel && (!alert || alert.rule_id !== 'threat_intel_match')) {
    await upsertAlert({
      rule_id: 'threat_intel_match',
      title: 'Known-bad indicator seen',
      description: intel.description,
      severity: intel.severity,
      source_ip: entry.source_ip,
      user_id: entry.user_id,
      log_id: logId,
    });
  }
}

export async function checkBruteForce(ip: string | null, email: string): Promise<void> {
  if (!isRuleEnabled('auth_brute_force')) return;
  const windowMinutes = 5;
  const threshold = 5;
  const { rows } = await pool.query(
    `SELECT count(*)::int AS c FROM siem_logs
     WHERE event_type = 'auth_login_failed'
       AND ts > now() - interval '${windowMinutes} minutes'
       AND ((source_ip IS NOT NULL AND source_ip = $1) OR metadata->>'email' = $2)`,
    [ip, email]
  );
  const count = rows[0]?.c ?? 0;
  if (count >= threshold) {
    await upsertAlert({
      rule_id: 'auth_brute_force',
      title: 'Possible brute-force login attempt',
      description: `${count} failed login attempts in the last ${windowMinutes} minutes from ${ip ?? 'unknown IP'} targeting ${email}`,
      severity: 'high',
      source_ip: ip,
      user_id: null,
    });
  }
}
