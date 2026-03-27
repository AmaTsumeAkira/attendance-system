import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { successRes, errorRes, paginatedRes, nowStr } from '../utils/helpers.js';

const router = Router();
router.use(authMiddleware);

// GET /leaves
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status, user_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (status) { where += ' AND l.status = ?'; params.push(status); }
    if (user_id) { where += ' AND l.user_id = ?'; params.push(user_id); }
    // students can only see their own
    if (req.user.role === 'student') { where += ' AND l.user_id = ?'; params.push(req.user.id); }
    const total = db.prepare(`SELECT COUNT(*) as c FROM leave_requests l ${where}`).get(...params).c;
    const items = db.prepare(`
      SELECT l.*, u.real_name, u.student_id, s.session_date, s.title as session_title,
        r.real_name as reviewer_name
      FROM leave_requests l
      JOIN users u ON l.user_id = u.id
      LEFT JOIN sessions s ON l.session_id = s.id
      LEFT JOIN users r ON l.reviewer_id = r.id
      ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, Number(limit), Number(offset));
    res.json(paginatedRes(items, total, page, limit));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// POST /leaves
router.post('/', (req, res) => {
  try {
    const { session_id, reason, start_date, end_date } = req.body;
    if (!reason) return res.status(400).json(errorRes(400, '请假原因不能为空'));
    const db = getDb();
    const t = nowStr();
    const r = db.prepare('INSERT INTO leave_requests (user_id, session_id, reason, start_date, end_date, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)').run(
      req.user.id, session_id || null, reason, start_date || null, end_date || null, 'pending', t, t
    );
    res.json(successRes({ id: r.lastInsertRowid }, '申请已提交'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// GET /leaves/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const leave = db.prepare(`
      SELECT l.*, u.real_name, u.student_id, s.session_date, s.title as session_title
      FROM leave_requests l
      JOIN users u ON l.user_id = u.id
      LEFT JOIN sessions s ON l.session_id = s.id
      WHERE l.id = ?
    `).get(req.params.id);
    if (!leave) return res.status(404).json(errorRes(404, '请假记录不存在'));
    if (req.user.role === 'student' && leave.user_id !== req.user.id) {
      return res.status(403).json(errorRes(403, '无权查看'));
    }
    res.json(successRes(leave));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// PUT /leaves/:id/review
router.put('/:id/review', requireRole('super_admin', 'admin', 'teacher'), (req, res) => {
  try {
    const { status, comment } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json(errorRes(400, '状态必须为 approved 或 rejected'));
    }
    const db = getDb();
    const leave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(req.params.id);
    if (!leave) return res.status(404).json(errorRes(404, '请假记录不存在'));
    const t = nowStr();
    db.prepare('UPDATE leave_requests SET status=?, reviewer_id=?, review_comment=?, reviewed_at=?, updated_at=? WHERE id=?').run(
      status, req.user.id, comment || '', t, t, req.params.id
    );
    // If approved and linked to session, update attendance
    if (status === 'approved' && leave.session_id) {
      db.prepare("UPDATE attendance_records SET status='leave', leave_id=?, updated_at=? WHERE session_id=? AND user_id=?").run(
        leave.id, t, leave.session_id, leave.user_id
      );
    }
    const updated = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(req.params.id);
    res.json(successRes(updated, '审批完成'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// PUT /leaves/:id/cancel
router.put('/:id/cancel', (req, res) => {
  try {
    const db = getDb();
    const leave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(req.params.id);
    if (!leave) return res.status(404).json(errorRes(404, '请假记录不存在'));
    if (leave.user_id !== req.user.id && !['super_admin', 'admin'].includes(req.user.role)) {
      return res.status(403).json(errorRes(403, '无权操作'));
    }
    if (leave.status !== 'pending') return res.status(400).json(errorRes(400, '只有待审批的申请可以撤销'));
    db.prepare("UPDATE leave_requests SET status='cancelled', updated_at=? WHERE id=?").run(nowStr(), req.params.id);
    res.json(successRes(null, '已撤销'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

export default router;
