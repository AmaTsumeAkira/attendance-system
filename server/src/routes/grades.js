import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { successRes, errorRes, nowStr } from '../utils/helpers.js';

const router = Router();
router.use(authMiddleware);

// GET /grades
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const items = db.prepare('SELECT * FROM grades ORDER BY id').all();
    res.json(successRes(items));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// POST /grades
router.post('/', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json(errorRes(400, '年级名称不能为空'));
    const db = getDb();
    const t = nowStr();
    const r = db.prepare('INSERT INTO grades (name, description, created_at, updated_at) VALUES (?,?,?,?)').run(name, description || '', t, t);
    res.json(successRes({ id: r.lastInsertRowid, name, description: description || '' }, '创建成功'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// PUT /grades/:id
router.put('/:id', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const db = getDb();
    const g = db.prepare('SELECT * FROM grades WHERE id = ?').get(req.params.id);
    if (!g) return res.status(404).json(errorRes(404, '年级不存在'));
    const { name, description } = req.body;
    db.prepare('UPDATE grades SET name=?, description=?, updated_at=? WHERE id=?').run(name ?? g.name, description ?? g.description, nowStr(), req.params.id);
    const updated = db.prepare('SELECT * FROM grades WHERE id = ?').get(req.params.id);
    res.json(successRes(updated, '更新成功'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// DELETE /grades/:id
router.delete('/:id', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM grades WHERE id = ?').run(req.params.id);
    res.json(successRes(null, '已删除'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

export default router;
