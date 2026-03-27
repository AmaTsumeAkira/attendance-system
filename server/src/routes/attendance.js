import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { successRes, errorRes, paginatedRes, nowStr, toCsv } from '../utils/helpers.js';

const router = Router();
router.use(authMiddleware);

// GET /attendances/export  (must be before /:id)
router.get('/export', (req, res) => {
  try {
    const db = getDb();
    const { start_date, end_date, class_id } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (start_date) { where += ' AND s.session_date >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND s.session_date <= ?'; params.push(end_date); }
    if (class_id) { where += ' AND ar.class_id = ?'; params.push(class_id); }
    if (req.user.role === 'student') { where += ' AND ar.user_id = ?'; params.push(req.user.id); }
    const rows = db.prepare(`
      SELECT u.real_name, u.student_id, c.name as course_name, cl.name as class_name,
        s.session_date, ar.status, ar.check_in_time, ar.remark
      FROM attendance_records ar
      JOIN users u ON ar.user_id = u.id
      JOIN sessions s ON ar.session_id = s.id
      LEFT JOIN courses c ON ar.course_id = c.id
      LEFT JOIN classes cl ON ar.class_id = cl.id
      ${where} ORDER BY s.session_date, u.student_id
    `).all(...params);
    const headers = ['real_name', 'student_id', 'course_name', 'class_name', 'session_date', 'status', 'check_in_time', 'remark'];
    const headerLabels = ['姓名', '学号', '课程', '班级', '日期', '状态', '签到时间', '备注'];
    const csv = toCsv(headers, rows);
    // Replace header names
    const csvWithLabels = headerLabels.join(',') + '\n' + csv.split('\n').slice(1).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance_export.csv');
    res.send('\uFEFF' + csvWithLabels);
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// GET /attendances/my
router.get('/my', (req, res) => {
  try {
    const db = getDb();
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const total = db.prepare('SELECT COUNT(*) as c FROM attendance_records WHERE user_id = ?').get(req.user.id).c;
    const items = db.prepare(`
      SELECT ar.*, s.session_date, s.title as session_title, c.name as course_name, cl.name as class_name
      FROM attendance_records ar
      JOIN sessions s ON ar.session_id = s.id
      LEFT JOIN courses c ON ar.course_id = c.id
      LEFT JOIN classes cl ON ar.class_id = cl.id
      WHERE ar.user_id = ?
      ORDER BY s.session_date DESC LIMIT ? OFFSET ?
    `).all(req.user.id, Number(limit), Number(offset));
    res.json(paginatedRes(items, total, page, limit));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// GET /attendances
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { session_id, date, class_id, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (session_id) { where += ' AND ar.session_id = ?'; params.push(session_id); }
    if (date) { where += ' AND s.session_date = ?'; params.push(date); }
    if (class_id) { where += ' AND ar.class_id = ?'; params.push(class_id); }
    if (status) { where += ' AND ar.status = ?'; params.push(status); }
    if (req.user.role === 'student') { where += ' AND ar.user_id = ?'; params.push(req.user.id); }
    const total = db.prepare(`SELECT COUNT(*) as c FROM attendance_records ar LEFT JOIN sessions s ON ar.session_id = s.id ${where}`).get(...params).c;
    const items = db.prepare(`
      SELECT ar.*, u.real_name, u.student_id, s.session_date, s.title as session_title, c.name as course_name
      FROM attendance_records ar
      JOIN users u ON ar.user_id = u.id
      JOIN sessions s ON ar.session_id = s.id
      LEFT JOIN courses c ON ar.course_id = c.id
      ${where} ORDER BY ar.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, Number(limit), Number(offset));
    res.json(paginatedRes(items, total, page, limit));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// PUT /attendances/:id
router.put('/:id', requireRole('super_admin', 'admin', 'teacher'), (req, res) => {
  try {
    const db = getDb();
    const record = db.prepare('SELECT * FROM attendance_records WHERE id = ?').get(req.params.id);
    if (!record) return res.status(404).json(errorRes(404, '记录不存在'));
    const { status, remark } = req.body;
    if (!status) return res.status(400).json(errorRes(400, '请提供状态'));
    const checkInTime = (status === 'present' || status === 'late') ? (record.check_in_time || nowStr()) : null;
    db.prepare('UPDATE attendance_records SET status=?, remark=?, check_in_time=?, check_in_method=?, updated_at=? WHERE id=?').run(
      status, remark ?? record.remark, checkInTime, checkInTime ? 'manual' : '', nowStr(), req.params.id
    );
    const updated = db.prepare('SELECT * FROM attendance_records WHERE id = ?').get(req.params.id);
    res.json(successRes(updated, '更新成功'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

export default router;
