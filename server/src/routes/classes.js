import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { successRes, errorRes, nowStr, validateRequired } from '../utils/helpers.js';

const router = Router();
router.use(authMiddleware);

// GET /classes
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const items = db.prepare(`
      SELECT c.*, g.name as grade_name
      FROM classes c LEFT JOIN grades g ON c.grade_id = g.id
      ORDER BY c.id
    `).all();
    res.json(successRes(items));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// POST /classes
router.post('/', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const { name, grade_id, description } = req.body;
    if (!name) return res.status(400).json(errorRes(400, '班级名称不能为空'));
    const db = getDb();
    const t = nowStr();
    const r = db.prepare('INSERT INTO classes (name, grade_id, description, created_at, updated_at) VALUES (?,?,?,?,?)').run(name, grade_id || null, description || '', t, t);
    res.json(successRes({ id: r.lastInsertRowid }, '创建成功'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// GET /classes/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const cls = db.prepare('SELECT c.*, g.name as grade_name FROM classes c LEFT JOIN grades g ON c.grade_id = g.id WHERE c.id = ?').get(req.params.id);
    if (!cls) return res.status(404).json(errorRes(404, '班级不存在'));
    const students = db.prepare('SELECT u.id, u.username, u.real_name, u.student_id FROM class_students cs JOIN users u ON cs.user_id = u.id WHERE cs.class_id = ?').all(req.params.id);
    res.json(successRes({ ...cls, students }));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// PUT /classes/:id
router.put('/:id', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const db = getDb();
    const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
    if (!cls) return res.status(404).json(errorRes(404, '班级不存在'));
    const { name, grade_id, description } = req.body;
    db.prepare('UPDATE classes SET name=?, grade_id=?, description=?, updated_at=? WHERE id=?').run(
      name ?? cls.name, grade_id ?? cls.grade_id, description ?? cls.description, nowStr(), req.params.id
    );
    const updated = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
    res.json(successRes(updated, '更新成功'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// DELETE /classes/:id
router.delete('/:id', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id);
    res.json(successRes(null, '已删除'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// POST /classes/:id/students
router.post('/:id/students', requireRole('super_admin', 'admin', 'teacher'), (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || !userIds.length) return res.status(400).json(errorRes(400, '请提供学生ID列表'));
    const db = getDb();
    const insert = db.prepare('INSERT OR IGNORE INTO class_students (class_id, user_id) VALUES (?,?)');
    const txn = db.transaction(() => {
      for (const uid of userIds) insert.run(req.params.id, uid);
    });
    txn();
    res.json(successRes(null, '分配成功'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// DELETE /classes/:id/students/:uid
router.delete('/:id/students/:uid', requireRole('super_admin', 'admin', 'teacher'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM class_students WHERE class_id = ? AND user_id = ?').run(req.params.id, req.params.uid);
    res.json(successRes(null, '已移除'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

export default router;
