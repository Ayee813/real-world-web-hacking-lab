import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// INTENTIONAL VULN: no role check — any authenticated user sees all accounts
router.get('/users', requireAuth, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT id, email, username, role, created_at FROM users ORDER BY created_at ASC'
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
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
