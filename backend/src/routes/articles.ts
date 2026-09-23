import { Router, Response } from 'express';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { recordEvent, containsXss } from '../lib/siem';

const router = Router();

function clientIp(req: AuthRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || req.ip || 'unknown';
}

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

    if (req.query.public === 'false') {
      const othersCount = result.rows.filter(r => r.author_id !== req.user!.id).length;
      if (othersCount > 0) {
        await recordEvent(
          {
            event_type: 'idor_private_article',
            severity: 'medium',
            source_ip: clientIp(req),
            user_id: req.user!.id,
            message: `${req.user!.id} listed private articles via ?public=false (${othersCount} not owned by them)`,
            metadata: { total_returned: result.rows.length, not_owned: othersCount },
          },
          {
            rule_id: 'idor_private_article',
            title: 'Private article exposure',
            description: `GET /api/articles?public=false returned ${othersCount} private article(s) belonging to other users.`,
            severity: 'medium',
          }
        );
      }
    }

    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/articles/mine', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.title, a.body, a.is_public, a.created_at, u.username AS author, a.author_id
       FROM articles a
       JOIN users u ON a.author_id = u.id
       WHERE a.author_id = $1
       ORDER BY a.created_at DESC`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// INTENTIONAL VULN: no ownership check — any authenticated user can fetch any article (IDOR)
router.get('/articles/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
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
    const article = result.rows[0];
    if (!article.is_public && article.author_id !== req.user!.id) {
      await recordEvent(
        {
          event_type: 'idor_private_article',
          severity: 'medium',
          source_ip: clientIp(req),
          user_id: req.user!.id,
          message: `${req.user!.id} read private article ${article.id} owned by ${article.author_id}`,
          metadata: { article_id: article.id, owner_id: article.author_id },
        },
        {
          rule_id: 'idor_private_article',
          title: 'Private article exposure',
          description: `GET /api/articles/${article.id} returned a private article not owned by the requester.`,
          severity: 'medium',
        }
      );
    }
    res.json(article);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// INTENTIONAL VULN: stores raw HTML without sanitization (stored XSS)
router.post('/articles', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, body, is_public } = req.body ?? {};
  if (!title || !body) {
    res.status(400).json({ error: 'Title and body are required' });
    return;
  }
  try {
    const result = await pool.query(
      'INSERT INTO articles (author_id, title, body, is_public) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user!.id, title, body, is_public ?? true]
    );
    if (containsXss(body)) {
      await recordEvent(
        {
          event_type: 'stored_xss_attempt',
          severity: 'high',
          source_ip: clientIp(req),
          user_id: req.user!.id,
          message: `${req.user!.id} submitted an article body with an XSS signature (article ${result.rows[0].id})`,
          metadata: { article_id: result.rows[0].id, title },
        },
        {
          rule_id: 'stored_xss_attempt',
          title: 'Stored XSS payload submitted',
          description: `POST /api/articles body matched a script/event-handler XSS signature (article "${title}").`,
          severity: 'high',
        }
      );
    }
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/articles/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, body, is_public } = req.body ?? {};
  try {
    const current = await pool.query('SELECT * FROM articles WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }
    const a = current.rows[0];
    const newBody = body ?? a.body;
    const result = await pool.query(
      'UPDATE articles SET title=$1, body=$2, is_public=$3 WHERE id=$4 RETURNING *',
      [title ?? a.title, newBody, is_public ?? a.is_public, req.params.id]
    );
    if (body && containsXss(body)) {
      await recordEvent(
        {
          event_type: 'stored_xss_attempt',
          severity: 'high',
          source_ip: clientIp(req),
          user_id: req.user!.id,
          message: `${req.user!.id} edited article ${req.params.id} with a body containing an XSS signature`,
          metadata: { article_id: req.params.id },
        },
        {
          rule_id: 'stored_xss_attempt',
          title: 'Stored XSS payload submitted',
          description: `PUT /api/articles/${req.params.id} body matched a script/event-handler XSS signature.`,
          severity: 'high',
        }
      );
    }
    if (a.author_id !== req.user!.id) {
      await recordEvent({
        event_type: 'idor_article_edit',
        severity: 'medium',
        source_ip: clientIp(req),
        user_id: req.user!.id,
        message: `${req.user!.id} edited article ${req.params.id} owned by ${a.author_id}`,
        metadata: { article_id: req.params.id, owner_id: a.author_id },
      });
    }
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// INTENTIONAL VULN: no ownership check — any authenticated user can delete any article (IDOR)
router.delete('/articles/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const current = await pool.query('SELECT author_id, title FROM articles WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }
    const owned = current.rows[0].author_id === req.user!.id;
    const result = await pool.query('DELETE FROM articles WHERE id = $1 RETURNING id', [req.params.id]);
    if (!owned) {
      await recordEvent({
        event_type: 'idor_article_delete',
        severity: 'high',
        source_ip: clientIp(req),
        user_id: req.user!.id,
        message: `${req.user!.id} deleted article "${current.rows[0].title}" owned by ${current.rows[0].author_id}`,
        metadata: { article_id: req.params.id, owner_id: current.rows[0].author_id },
      });
    }
    res.json({ success: true, id: result.rows[0]?.id });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
