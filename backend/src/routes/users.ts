import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { recordEvent } from '../lib/siem';

const router = Router();

function clientIp(req: AuthRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || req.ip || 'unknown';
}

// INTENTIONAL VULN: no role check — any authenticated user sees all accounts
router.get('/users', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT id, email, username, role, created_at FROM users ORDER BY created_at ASC'
    );
    await recordEvent(
      {
        event_type: 'user_enumeration',
        severity: 'low',
        source_ip: clientIp(req),
        user_id: req.user!.id,
        message: `Full user directory (${result.rows.length} accounts) retrieved`,
      },
      {
        rule_id: 'user_enumeration',
        title: 'Full user directory access',
        description: `A non-admin-gated request returned all ${result.rows.length} accounts including emails and roles.`,
        severity: 'low',
      }
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// INTENTIONAL VULN: no ownership check — any authenticated user can read any profile
router.get('/user/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT id, email, username, role, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// INTENTIONAL VULN: accepts `role` field (mass assignment) + no ownership/role check (IDOR)
router.put('/user/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { email, username, password, role } = req.body;
  const ip = clientIp(req);
  try {
    const current = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const u = current.rows[0];
    const newEmail    = email    ?? u.email;
    const newUsername = username ?? u.username;
    const newRole     = role     ?? u.role;   // INTENTIONAL: allows privilege escalation
    const newPassword = password ? await bcrypt.hash(password, 10) : u.password;

    const isSelf = req.user!.id === req.params.id;

    if (role !== undefined && role !== u.role) {
      await recordEvent(
        {
          event_type: 'privilege_escalation_attempt',
          severity: 'critical',
          source_ip: ip,
          user_id: req.user!.id,
          message: `${req.user!.id} attempted to set role="${role}" on user ${req.params.id} via mass assignment`,
          metadata: { target_user_id: req.params.id, requested_role: role, previous_role: u.role, self: isSelf },
        },
        {
          rule_id: 'privilege_escalation_attempt',
          title: 'Mass-assignment privilege escalation attempt',
          description: `PUT /api/user/${req.params.id} included "role":"${role}" (was "${u.role}").`,
          severity: 'critical',
        }
      );
    } else if (!isSelf) {
      await recordEvent(
        {
          event_type: 'idor_user_edit',
          severity: 'medium',
          source_ip: ip,
          user_id: req.user!.id,
          message: `${req.user!.id} edited profile of another user (${req.params.id})`,
          metadata: { target_user_id: req.params.id, fields: Object.keys(req.body ?? {}) },
        },
        {
          rule_id: 'idor_user_edit',
          title: 'Unauthorized profile edit',
          description: `PUT /api/user/${req.params.id} was issued by a different user (${req.user!.id}).`,
          severity: 'medium',
        }
      );
    }

    const result = await pool.query(
      'UPDATE users SET email=$1, username=$2, password=$3, role=$4 WHERE id=$5 RETURNING id, email, username, role',
      [newEmail, newUsername, newPassword, newRole, req.params.id]
    );
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// INTENTIONAL VULN: no authorization check — any authenticated user can delete anyone
router.delete('/user/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const ip = clientIp(req);
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, username, email', [req.params.id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const isSelf = req.user!.id === req.params.id;
    await recordEvent(
      {
        event_type: 'user_deleted',
        severity: isSelf ? 'info' : 'high',
        source_ip: ip,
        user_id: req.user!.id,
        message: isSelf
          ? `${req.user!.id} deleted their own account`
          : `${req.user!.id} deleted another user's account (${result.rows[0].username})`,
        metadata: { target_user_id: req.params.id, target_username: result.rows[0].username, self: isSelf },
      },
      isSelf
        ? undefined
        : {
            rule_id: 'idor_user_delete',
            title: 'Unauthorized account deletion',
            description: `DELETE /api/user/${req.params.id} (${result.rows[0].username}) was issued by a different user (${req.user!.id}).`,
            severity: 'high',
          }
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
