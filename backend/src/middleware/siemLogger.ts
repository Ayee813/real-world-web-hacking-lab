import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { insertLog, matchThreatIntel, Severity } from '../lib/siem';

function severityForStatus(status: number): Severity {
  if (status >= 500) return 'high';
  if (status === 401 || status === 403) return 'medium';
  if (status >= 400) return 'low';
  return 'info';
}

function clientIp(req: AuthRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || req.ip || 'unknown';
}

// Skip noisy/duplicate paths: SIEM's own polling and static assets are not
// interesting security events on their own.
const SKIP_PREFIXES = ['/api/siem'];

export function siemAccessLogger(req: AuthRequest, res: Response, next: NextFunction): void {
  if (SKIP_PREFIXES.some(p => req.path.startsWith(p))) {
    next();
    return;
  }

  const ip = clientIp(req);
  const start = Date.now();

  res.on('finish', () => {
    const status = res.statusCode;
    const intel = matchThreatIntel(ip, req.originalUrl);
    const severity = intel ? intel.severity : severityForStatus(status);

    insertLog({
      event_type: 'http_request',
      severity,
      source_ip: ip,
      method: req.method,
      path: req.originalUrl,
      status_code: status,
      user_id: req.user?.id ?? null,
      username: undefined,
      message: `${req.method} ${req.originalUrl} -> ${status}`,
      metadata: {
        duration_ms: Date.now() - start,
        user_agent: req.headers['user-agent'] ?? null,
        ...(intel ? { threat_intel_match: intel.description } : {}),
      },
    }).catch(err => console.error('[siem] access log insert failed', err));
  });

  next();
}
