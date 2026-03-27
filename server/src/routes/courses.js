import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { successRes, errorRes, nowStr } from '../utils/helpers.js';

const router = Router();
router.use(authMiddleware);

// GET /courses
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const items = db.prepare(`
      SELECT c.*, u.real_name as teacher_name
      FROM courses c LEFT JOIN users u ON c.teacher_id = u.id
      ORDER BY c.id
    `).all();
    res.json(successRes(items));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// POST /courses
router.post('/', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const { name, code, description, teacher_id, semester } = req.body;
    if (!name) return res.status(400).json(errorRes(400, '课程名称不能为空'));
    const db = getDb();
    const t = nowStr();
    const r = db.prepare('INSERT INTO courses (name, code, description, teacher_id, semester, created_at, updated_at) VALUES (?,?,?,?,?,?,?)').run(
      name, code || '', description || '', teacher_id || null, semester || '', t, t
    );
    res.json(successRes({ id: r.lastInsertRowid }, '创建成功'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// GET /courses/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const course = db.prepare('SELECT c.*, u.real_name as teacher_name FROM courses c LEFT JOIN users u ON c.teacher_id = u.id WHERE c.id = ?').get(req.params.id);
    if (!course) return res.status(404).json(errorRes(404, '课程不存在'));
    const classes = db.prepare('SELECT cl.id, cl.name, cc.semester FROM course_classes cc JOIN classes cl ON cc.class_id = cl.id WHERE cc.course_id = ?').all(req.params.id);
    res.json(successRes({ ...course, classes }));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// PUT /courses/:id
router.put('/:id', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const db = getDb();
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
    if (!course) return res.status(404).json(errorRes(404, '课程不存在'));
    const { name, code, description, teacher_id, semester } = req.body;
    db.prepare('UPDATE courses SET name=?, code=?, description=?, teacher_id=?, semester=?, updated_at=? WHERE id=?').run(
      name ?? course.name, code ?? course.code, description ?? course.description,
      teacher_id ?? course.teacher_id, semester ?? course.semester, nowStr(), req.params.id
    );
    const updated = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
    res.json(successRes(updated, '更新成功'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// DELETE /courses/:id
router.delete('/:id', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
    res.json(successRes(null, '已删除'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// POST /courses/:id/classes
router.post('/:id/classes', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const { classIds, semester } = req.body;
    if (!Array.isArray(classIds) || !classIds.length) return res.status(400).json(errorRes(400, '请提供班级ID列表'));
    const db = getDb();
    const insert = db.prepare('INSERT OR IGNORE INTO course_classes (course_id, class_id, semester) VALUES (?,?,?)');
    const txn = db.transaction(() => {
      for (const cid of classIds) insert.run(req.params.id, cid, semester || '');
    });
    txn();
    res.json(successRes(null, '关联成功'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

export default router;
