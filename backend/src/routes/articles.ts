import { Router, Response } from 'express';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// INTENTIONAL VULN: trusts client-supplied `public` param; no ownership check
router.get('/articles', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const base = `
      SELECT a.id, a.title, a.body, a.is_public, a.created_at, u.username AS author, a.author_id
      FROM articles a
      JOIN users u ON a.author_id = u.id
    `;
    let query: string;
    let params: unknown[];

    if (req.query.public === 'true') {
      query = base + ' WHERE a.is_public = true ORDER BY a.created_at DESC';
      params = [];
    } else if (req.query.public === 'false') {
      query = base + ' WHERE a.is_public = false ORDER BY a.created_at DESC';
      params = [];
    } else {
      query = base + ' ORDER BY a.created_at DESC';
      params = [];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/article/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.title, a.body, a.is_public, a.created_at, u.username AS author, a.author_id
       FROM articles a
       JOIN users u ON a.author_id = u.id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// INTENTIONAL VULN: stores raw HTML without sanitization (stored XSS)
router.post('/articles', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, body, is_public } = req.body;
  if (!title || !body) {
    res.status(400).json({ error: 'Title and body are required' });
    return;
  }
  try {
    const result = await pool.query(
      'INSERT INTO articles (author_id, title, body, is_public) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user!.id, title, body, is_public ?? true]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/article/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, body, is_public } = req.body;
  try {
    const current = await pool.query('SELECT * FROM articles WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }
    const a = current.rows[0];
    const result = await pool.query(
      'UPDATE articles SET title=$1, body=$2, is_public=$3 WHERE id=$4 RETURNING *',
      [title ?? a.title, body ?? a.body, is_public ?? a.is_public, req.params.id]
    );
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/article/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await pool.query('DELETE FROM articles WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
