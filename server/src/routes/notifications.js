import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { successRes, errorRes, paginatedRes, nowStr } from '../utils/helpers.js';

const router = Router();
router.use(authMiddleware);

// GET /notifications
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { is_read, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE user_id = ?';
    const params = [req.user.id];
    if (is_read !== undefined && is_read !== '') {
      where += ' AND is_read = ?';
      params.push(Number(is_read));
    }
    const total = db.prepare(`SELECT COUNT(*) as c FROM notifications ${where}`).get(...params).c;
    const items = db.prepare(`SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), Number(offset));
    res.json(paginatedRes(items, total, page, limit));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// GET /notifications/unread-count
router.get('/unread-count', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id);
    res.json(successRes({ count: row.c }));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// PUT /notifications/read-all
router.put('/read-all', (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
    res.json(successRes(null, '已全部标记已读'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// PUT /notifications/:id/read
router.put('/:id/read', (req, res) => {
  try {
    const db = getDb();
    const n = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!n) return res.status(404).json(errorRes(404, '通知不存在'));
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
    res.json(successRes(null, '已标记已读'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// DELETE /notifications/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const n = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!n) return res.status(404).json(errorRes(404, '通知不存在'));
    db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
    res.json(successRes(null, '已删除'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

export default router;
