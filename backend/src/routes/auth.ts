import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { recordEvent, checkBruteForce } from '../lib/siem';

const router = Router();

function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || req.ip || 'unknown';
}

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, username, password, role) VALUES ($1, $2, $3, $4) RETURNING id, email, username, role',
      [email, username, hash, 'user']
    );
    await recordEvent({
      event_type: 'user_registered',
      severity: 'info',
      source_ip: clientIp(req),
      user_id: result.rows[0].id,
      username: result.rows[0].username,
      message: `New account registered: ${email}`,
    });
    res.status(201).json({ user: result.rows[0] });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  const ip = clientIp(req);
  if (!email || !password) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) {
      await recordEvent({
        event_type: 'auth_login_failed',
        severity: 'low',
        source_ip: ip,
        message: `Failed login for unknown email ${email}`,
        metadata: { email, reason: 'no_such_user' },
      });
      await checkBruteForce(ip, email);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await recordEvent({
        event_type: 'auth_login_failed',
        severity: 'low',
        source_ip: ip,
        user_id: user.id,
        username: user.username,
        message: `Failed login for ${email}: wrong password`,
        metadata: { email, reason: 'bad_password' },
      });
      await checkBruteForce(ip, email);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    await recordEvent({
      event_type: 'auth_login_success',
      severity: 'info',
      source_ip: ip,
      user_id: user.id,
      username: user.username,
      message: `${user.username} logged in`,
    });
    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT id, email, username, role, created_at FROM users WHERE id = $1',
      [req.user!.id]
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

export default router;
