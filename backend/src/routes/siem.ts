import { Router, Response } from 'express';
import pool from '../db';
import { requireAuth, requireSiemAccess, requireAdmin, AuthRequest } from '../middleware/auth';
import { recordEvent, invalidateSiemCaches } from '../lib/siem';

const router = Router();

router.use(requireAuth, requireSiemAccess);

function clientIp(req: AuthRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || req.ip || 'unknown';
}

async function audit(req: AuthRequest, message: string, metadata?: Record<string, unknown>): Promise<void> {
  await recordEvent({
    event_type: 'siem_admin_action',
    severity: 'info',
    source_ip: clientIp(req),
    user_id: req.user!.id,
    message,
    metadata,
  });
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------
// Logs: search, detail, export
// ---------------------------------------------------------------------

router.get('/logs', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q, from, to, severity, event_type, source_ip, user_id, method, status_code } = req.query;
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 500);
    const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);

    const clauses: string[] = [];
    const params: unknown[] = [];

    function add(clause: string, value: unknown) {
      params.push(value);
      clauses.push(clause.replace('?', `$${params.length}`));
    }

    if (from) add('ts >= ?', from);
    if (to) add('ts <= ?', to);
    if (severity) add('severity = ?', severity);
    if (event_type) add('event_type = ?', event_type);
    if (source_ip) add('source_ip = ?', source_ip);
    if (user_id) add('user_id = ?', user_id);
    if (method) add('method = ?', method);
    if (status_code) add('status_code = ?', parseInt(String(status_code), 10));
    if (q) {
      params.push(`%${q}%`);
      const idx = params.length;
      clauses.push(`(message ILIKE $${idx} OR path ILIKE $${idx} OR username ILIKE $${idx})`);
    }

    const where = clauses.length > 0 ? 'WHERE ' + clauses.join(' AND ') : '';

    const countResult = await pool.query(`SELECT count(*)::int AS c FROM siem_logs ${where}`, params);
    const dataResult = await pool.query(
      `SELECT * FROM siem_logs ${where} ORDER BY ts DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ total: countResult.rows[0].c, limit, offset, logs: dataResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/logs/export', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from, to, severity, event_type } = req.query;
    const clauses: string[] = [];
    const params: unknown[] = [];
    function add(clause: string, value: unknown) {
      params.push(value);
      clauses.push(clause.replace('?', `$${params.length}`));
    }
    if (from) add('ts >= ?', from);
    if (to) add('ts <= ?', to);
    if (severity) add('severity = ?', severity);
    if (event_type) add('event_type = ?', event_type);
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';

    const result = await pool.query(
      `SELECT ts, event_type, severity, source_ip, method, path, status_code, username, message
       FROM siem_logs ${where} ORDER BY ts DESC LIMIT 10000`,
      params
    );

    const header = ['timestamp', 'event_type', 'severity', 'source_ip', 'method', 'path', 'status_code', 'username', 'message'];
    const rows = result.rows.map(r =>
      [r.ts.toISOString(), r.event_type, r.severity, r.source_ip, r.method, r.path, r.status_code, r.username, r.message]
        .map(csvEscape)
        .join(',')
    );
    const csv = [header.join(','), ...rows].join('\n');

    await audit(req, `Exported ${result.rows.length} log rows to CSV`);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="siem_logs_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/logs/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM siem_logs WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Log not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------
// Stats / dashboard
// ---------------------------------------------------------------------

router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const range = String(req.query.range ?? '24h');
    const { interval, bucket } = range === '7d'
      ? { interval: '7 days', bucket: 'hour' }
      : range === '30d'
      ? { interval: '30 days', bucket: 'day' }
      : { interval: '24 hours', bucket: 'hour' };

    const [totalEvents, severityBreakdown, eventsOverTime, topEventTypes, topSourceIps, topTargetedUsers, alertCounts, caseCounts] =
      await Promise.all([
        pool.query(`SELECT count(*)::int AS c FROM siem_logs WHERE ts > now() - interval '${interval}'`),
        pool.query(
          `SELECT severity, count(*)::int AS c FROM siem_logs WHERE ts > now() - interval '${interval}' GROUP BY severity`
        ),
        pool.query(
          `SELECT date_trunc('${bucket}', ts) AS bucket, count(*)::int AS c
           FROM siem_logs WHERE ts > now() - interval '${interval}'
           GROUP BY bucket ORDER BY bucket ASC`
        ),
        pool.query(
          `SELECT event_type, count(*)::int AS c FROM siem_logs WHERE ts > now() - interval '${interval}'
           GROUP BY event_type ORDER BY c DESC LIMIT 10`
        ),
        pool.query(
          `SELECT source_ip, count(*)::int AS c FROM siem_logs WHERE ts > now() - interval '${interval}' AND source_ip IS NOT NULL
           GROUP BY source_ip ORDER BY c DESC LIMIT 10`
        ),
        pool.query(
          `SELECT u.username, u.id AS user_id, count(*)::int AS c
           FROM siem_logs l JOIN users u ON u.id = l.user_id
           WHERE l.ts > now() - interval '${interval}'
           GROUP BY u.username, u.id ORDER BY c DESC LIMIT 10`
        ),
        pool.query(
          `SELECT status, severity, count(*)::int AS c FROM siem_alerts
           WHERE created_at > now() - interval '${interval}' GROUP BY status, severity`
        ),
        pool.query(`SELECT status, count(*)::int AS c FROM siem_cases GROUP BY status`),
      ]);

    res.json({
      range,
      total_events: totalEvents.rows[0].c,
      severity_breakdown: severityBreakdown.rows,
      events_over_time: eventsOverTime.rows,
      top_event_types: topEventTypes.rows,
      top_source_ips: topSourceIps.rows,
      top_targeted_users: topTargetedUsers.rows,
      alert_counts: alertCounts.rows,
      case_counts: caseCounts.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------

router.get('/alerts', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, severity, rule_id } = req.query;
    const clauses: string[] = [];
    const params: unknown[] = [];
    function add(clause: string, value: unknown) {
      params.push(value);
      clauses.push(clause.replace('?', `$${params.length}`));
    }
    if (status) add('status = ?', status);
    if (severity) add('severity = ?', severity);
    if (rule_id) add('rule_id = ?', rule_id);
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';

    const result = await pool.query(
      `SELECT a.*, u.username AS target_username
       FROM siem_alerts a LEFT JOIN users u ON u.id = a.user_id
       ${where} ORDER BY a.created_at DESC LIMIT 200`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/alerts/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alert = await pool.query('SELECT * FROM siem_alerts WHERE id = $1', [req.params.id]);
    if (!alert.rows[0]) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    const logIds: string[] = alert.rows[0].log_ids ?? [];
    const logs = logIds.length
      ? await pool.query('SELECT * FROM siem_logs WHERE id = ANY($1::uuid[]) ORDER BY ts DESC', [logIds])
      : { rows: [] };
    res.json({ ...alert.rows[0], logs: logs.rows });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/alerts/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, case_id } = req.body ?? {};
    const current = await pool.query('SELECT * FROM siem_alerts WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }
    const resolved = status === 'resolved';
    const result = await pool.query(
      `UPDATE siem_alerts SET
         status = COALESCE($1, status),
         case_id = COALESCE($2, case_id),
         resolved_at = CASE WHEN $1 = 'resolved' THEN now() ELSE resolved_at END,
         resolved_by = CASE WHEN $1 = 'resolved' THEN $3 ELSE resolved_by END
       WHERE id = $4 RETURNING *`,
      [status ?? null, case_id ?? null, req.user!.id, req.params.id]
    );
    await audit(req, `${status ? `Set alert ${req.params.id} status to "${status}"` : `Updated alert ${req.params.id}`}`, {
      alert_id: req.params.id,
      status,
      case_id,
    });
    void resolved;
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------

router.get('/cases', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (status) {
      params.push(status);
      clauses.push(`c.status = $${params.length}`);
    }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    const result = await pool.query(
      `SELECT c.*, au.username AS assignee_username, cu.username AS creator_username,
              (SELECT count(*)::int FROM siem_alerts a WHERE a.case_id = c.id) AS alert_count
       FROM siem_cases c
       LEFT JOIN users au ON au.id = c.assigned_to
       LEFT JOIN users cu ON cu.id = c.created_by
       ${where} ORDER BY c.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/cases', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, severity, assigned_to, alert_ids } = req.body ?? {};
    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO siem_cases (title, description, severity, assigned_to, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title, description ?? null, severity ?? 'medium', assigned_to ?? null, req.user!.id]
    );
    const caseRow = result.rows[0];
    if (Array.isArray(alert_ids) && alert_ids.length > 0) {
      await pool.query('UPDATE siem_alerts SET case_id = $1 WHERE id = ANY($2::uuid[])', [caseRow.id, alert_ids]);
    }
    await audit(req, `Opened case "${title}"`, { case_id: caseRow.id });
    res.status(201).json(caseRow);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/cases/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const caseResult = await pool.query(
      `SELECT c.*, au.username AS assignee_username, cu.username AS creator_username
       FROM siem_cases c
       LEFT JOIN users au ON au.id = c.assigned_to
       LEFT JOIN users cu ON cu.id = c.created_by
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!caseResult.rows[0]) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }
    const [alerts, notes] = await Promise.all([
      pool.query('SELECT * FROM siem_alerts WHERE case_id = $1 ORDER BY created_at DESC', [req.params.id]),
      pool.query(
        `SELECT n.*, u.username AS author_username FROM siem_case_notes n
         LEFT JOIN users u ON u.id = n.author_id WHERE n.case_id = $1 ORDER BY n.created_at ASC`,
        [req.params.id]
      ),
    ]);
    res.json({ ...caseResult.rows[0], alerts: alerts.rows, notes: notes.rows });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/cases/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, status, severity, assigned_to } = req.body ?? {};
    const current = await pool.query('SELECT * FROM siem_cases WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }
    const result = await pool.query(
      `UPDATE siem_cases SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         status = COALESCE($3, status),
         severity = COALESCE($4, severity),
         assigned_to = COALESCE($5, assigned_to),
         updated_at = now(),
         closed_at = CASE WHEN $3 = 'closed' THEN now() ELSE closed_at END
       WHERE id = $6 RETURNING *`,
      [title ?? null, description ?? null, status ?? null, severity ?? null, assigned_to ?? null, req.params.id]
    );
    await audit(req, `Updated case ${req.params.id}`, { case_id: req.params.id, status });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/cases/:id/notes', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { note } = req.body ?? {};
    if (!note) {
      res.status(400).json({ error: 'Note text is required' });
      return;
    }
    const result = await pool.query(
      'INSERT INTO siem_case_notes (case_id, author_id, note) VALUES ($1,$2,$3) RETURNING *',
      [req.params.id, req.user!.id, note]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/cases/:id/alerts', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { alert_id } = req.body ?? {};
    if (!alert_id) {
      res.status(400).json({ error: 'alert_id is required' });
      return;
    }
    await pool.query('UPDATE siem_alerts SET case_id = $1 WHERE id = $2', [req.params.id, alert_id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------
// Detection rules (admin-managed)
// ---------------------------------------------------------------------

router.get('/rules', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM siem_detection_rules ORDER BY name ASC');
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/rules/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { enabled } = req.body ?? {};
    const result = await pool.query(
      'UPDATE siem_detection_rules SET enabled = COALESCE($1, enabled) WHERE id = $2 RETURNING *',
      [enabled ?? null, req.params.id]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    invalidateSiemCaches();
    await audit(req, `${enabled ? 'Enabled' : 'Disabled'} detection rule "${req.params.id}"`, { rule_id: req.params.id, enabled });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------
// Threat intel (admin-managed)
// ---------------------------------------------------------------------

router.get('/threat-intel', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM siem_threat_intel ORDER BY created_at DESC');
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/threat-intel', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, value, description, severity } = req.body ?? {};
    if (!type || !value) {
      res.status(400).json({ error: 'type and value are required' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO siem_threat_intel (type, value, description, severity) VALUES ($1,$2,$3,$4)
       ON CONFLICT (type, value) DO UPDATE SET description = EXCLUDED.description, severity = EXCLUDED.severity
       RETURNING *`,
      [type, value, description ?? null, severity ?? 'medium']
    );
    invalidateSiemCaches();
    await audit(req, `Added threat intel indicator (${type}: ${value})`, { type, value });
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/threat-intel/:id', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query('DELETE FROM siem_threat_intel WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Indicator not found' });
      return;
    }
    invalidateSiemCaches();
    await audit(req, `Removed threat intel indicator ${req.params.id}`);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------
// Settings / retention (admin-managed)
// ---------------------------------------------------------------------

router.get('/settings', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT key, value FROM siem_settings');
    const settings: Record<string, string> = {};
    for (const row of result.rows) settings[row.key] = row.value;
    res.json(settings);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/settings', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { retention_days } = req.body ?? {};
    if (retention_days !== undefined) {
      const days = parseInt(String(retention_days), 10);
      if (!Number.isFinite(days) || days < 1) {
        res.status(400).json({ error: 'retention_days must be a positive integer' });
        return;
      }
      await pool.query(
        `INSERT INTO siem_settings (key, value) VALUES ('retention_days', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [String(days)]
      );
      await audit(req, `Set log retention to ${days} days`, { retention_days: days });
    }
    const result = await pool.query('SELECT key, value FROM siem_settings');
    const settings: Record<string, string> = {};
    for (const row of result.rows) settings[row.key] = row.value;
    res.json(settings);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/retention/purge', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const setting = await pool.query("SELECT value FROM siem_settings WHERE key = 'retention_days'");
    const days = parseInt(setting.rows[0]?.value ?? '30', 10);
    const result = await pool.query(`DELETE FROM siem_logs WHERE ts < now() - ($1 || ' days')::interval RETURNING id`, [days]);
    await audit(req, `Purged ${result.rowCount} log rows older than ${days} days`, { deleted: result.rowCount, retention_days: days });
    res.json({ deleted: result.rowCount, retention_days: days });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------

router.get('/report', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const from = req.query.from ? String(req.query.from) : new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const to = req.query.to ? String(req.query.to) : new Date().toISOString();

    const [totals, bySeverity, byEventType, alertsCreated, alertsResolved, topIps, topUsers, casesOpened, casesClosed] =
      await Promise.all([
        pool.query('SELECT count(*)::int AS c FROM siem_logs WHERE ts BETWEEN $1 AND $2', [from, to]),
        pool.query('SELECT severity, count(*)::int AS c FROM siem_logs WHERE ts BETWEEN $1 AND $2 GROUP BY severity', [from, to]),
        pool.query(
          'SELECT event_type, count(*)::int AS c FROM siem_logs WHERE ts BETWEEN $1 AND $2 GROUP BY event_type ORDER BY c DESC',
          [from, to]
        ),
        pool.query('SELECT count(*)::int AS c FROM siem_alerts WHERE created_at BETWEEN $1 AND $2', [from, to]),
        pool.query("SELECT count(*)::int AS c FROM siem_alerts WHERE resolved_at BETWEEN $1 AND $2", [from, to]),
        pool.query(
          `SELECT source_ip, count(*)::int AS c FROM siem_logs WHERE ts BETWEEN $1 AND $2 AND source_ip IS NOT NULL
           GROUP BY source_ip ORDER BY c DESC LIMIT 10`,
          [from, to]
        ),
        pool.query(
          `SELECT u.username, count(*)::int AS c FROM siem_logs l JOIN users u ON u.id = l.user_id
           WHERE l.ts BETWEEN $1 AND $2 GROUP BY u.username ORDER BY c DESC LIMIT 10`,
          [from, to]
        ),
        pool.query('SELECT count(*)::int AS c FROM siem_cases WHERE created_at BETWEEN $1 AND $2', [from, to]),
        pool.query('SELECT count(*)::int AS c FROM siem_cases WHERE closed_at BETWEEN $1 AND $2', [from, to]),
      ]);

    await audit(req, `Generated SIEM report for ${from} to ${to}`);

    res.json({
      range: { from, to },
      total_events: totals.rows[0].c,
      severity_breakdown: bySeverity.rows,
      event_type_breakdown: byEventType.rows,
      alerts_created: alertsCreated.rows[0].c,
      alerts_resolved: alertsResolved.rows[0].c,
      cases_opened: casesOpened.rows[0].c,
      cases_closed: casesClosed.rows[0].c,
      top_source_ips: topIps.rows,
      top_targeted_users: topUsers.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------
// SIEM's own audit trail (who viewed/changed what in the SIEM itself)
// ---------------------------------------------------------------------

router.get('/audit', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT l.*, u.username FROM siem_logs l LEFT JOIN users u ON u.id = l.user_id
       WHERE l.event_type = 'siem_admin_action' ORDER BY l.ts DESC LIMIT 200`
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
