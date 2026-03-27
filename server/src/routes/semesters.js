import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { successRes, errorRes, nowStr } from '../utils/helpers.js';

const router = Router();
router.use(authMiddleware);

// GET /semesters
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const items = db.prepare('SELECT * FROM semesters ORDER BY start_date DESC').all();
    res.json(successRes(items));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// POST /semesters
router.post('/', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const { name, start_date, end_date } = req.body;
    if (!name || !start_date || !end_date) {
      return res.status(400).json(errorRes(400, 'name, start_date, end_date 为必填项'));
    }
    const db = getDb();
    const exists = db.prepare('SELECT id FROM semesters WHERE name = ?').get(name);
    if (exists) return res.status(400).json(errorRes(400, '学期名称已存在'));
    const r = db.prepare('INSERT INTO semesters (name, start_date, end_date, created_at) VALUES (?,?,?,?)').run(name, start_date, end_date, nowStr());
    const item = db.prepare('SELECT * FROM semesters WHERE id = ?').get(r.lastInsertRowid);
    res.json(successRes(item, '创建成功'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// PUT /semesters/:id
router.put('/:id', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const db = getDb();
    const s = db.prepare('SELECT * FROM semesters WHERE id = ?').get(req.params.id);
    if (!s) return res.status(404).json(errorRes(404, '学期不存在'));
    const { name, start_date, end_date } = req.body;
    db.prepare('UPDATE semesters SET name=?, start_date=?, end_date=? WHERE id=?').run(
      name ?? s.name, start_date ?? s.start_date, end_date ?? s.end_date, req.params.id
    );
    const updated = db.prepare('SELECT * FROM semesters WHERE id = ?').get(req.params.id);
    res.json(successRes(updated, '更新成功'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// PUT /semesters/:id/set-current
router.put('/:id/set-current', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const db = getDb();
    const s = db.prepare('SELECT * FROM semesters WHERE id = ?').get(req.params.id);
    if (!s) return res.status(404).json(errorRes(404, '学期不存在'));
    db.transaction(() => {
      db.prepare('UPDATE semesters SET is_current = 0').run();
      db.prepare('UPDATE semesters SET is_current = 1 WHERE id = ?').run(req.params.id);
    })();
    const updated = db.prepare('SELECT * FROM semesters WHERE id = ?').get(req.params.id);
    res.json(successRes(updated, '已设为当前学期'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// DELETE /semesters/:id
router.delete('/:id', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const db = getDb();
    const s = db.prepare('SELECT * FROM semesters WHERE id = ?').get(req.params.id);
    if (!s) return res.status(404).json(errorRes(404, '学期不存在'));
    db.prepare('DELETE FROM semesters WHERE id = ?').run(req.params.id);
    res.json(successRes(null, '已删除'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

export default router;
