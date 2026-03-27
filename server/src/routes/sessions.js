import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { successRes, errorRes, paginatedRes, nowStr, todayStr, uuid } from '../utils/helpers.js';
import { pushNotificationToUser } from '../ws/handler.js';

const router = Router();
router.use(authMiddleware);

// GET /sessions
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { date, course_id, class_id, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (date) { where += ' AND s.session_date = ?'; params.push(date); }
    if (course_id) { where += ' AND s.course_id = ?'; params.push(course_id); }
    if (class_id) { where += ' AND s.class_id = ?'; params.push(class_id); }
    if (status) { where += ' AND s.status = ?'; params.push(status); }

    // students can only see sessions for their classes
    if (req.user.role === 'student') {
      where += ' AND s.class_id IN (SELECT class_id FROM class_students WHERE user_id = ?)';
      params.push(req.user.id);
    }

    const total = db.prepare(`SELECT COUNT(*) as c FROM sessions s ${where}`).get(...params).c;
    const items = db.prepare(`
      SELECT s.*, c.name as course_name, cl.name as class_name,
        (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.status IN ('present','late')) as checked_in,
        (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = s.class_id) as total_students
      FROM sessions s
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN classes cl ON s.class_id = cl.id
      ${where} ORDER BY s.session_date DESC, s.start_time DESC LIMIT ? OFFSET ?
    `).all(...params, Number(limit), Number(offset));
    res.json(paginatedRes(items, total, page, limit));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// POST /sessions
router.post('/', requireRole('super_admin', 'admin', 'teacher'), (req, res) => {
  try {
    const { course_id, class_id, title, session_date, start_time, end_time, late_threshold_min, auto_end_min } = req.body;
    if (!course_id || !class_id || !session_date) {
      return res.status(400).json(errorRes(400, 'course_id, class_id, session_date 为必填项'));
    }
    const db = getDb();
    const t = nowStr();
    const r = db.prepare(`
      INSERT INTO sessions (course_id, class_id, title, session_date, start_time, end_time, status, late_threshold_min, auto_end_min, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(course_id, class_id, title || '', session_date, start_time || '', end_time || '', 'scheduled', late_threshold_min || 10, auto_end_min || 60, req.user.id, t, t);
    res.json(successRes({ id: r.lastInsertRowid }, '创建成功'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// GET /sessions/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const session = db.prepare(`
      SELECT s.*, c.name as course_name, cl.name as class_name
      FROM sessions s
      LEFT JOIN courses c ON s.course_id = c.id
      LEFT JOIN classes cl ON s.class_id = cl.id
      WHERE s.id = ?
    `).get(req.params.id);
    if (!session) return res.status(404).json(errorRes(404, '签到会话不存在'));
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN ar.status = 'leave' THEN 1 ELSE 0 END) as leave
      FROM attendance_records ar WHERE ar.session_id = ?
    `).get(req.params.id);
    const records = db.prepare(`
      SELECT ar.*, u.real_name, u.student_id
      FROM attendance_records ar
      JOIN users u ON ar.user_id = u.id
      WHERE ar.session_id = ?
      ORDER BY ar.check_in_time
    `).all(req.params.id);
    res.json(successRes({ ...session, stats, records }));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// PUT /sessions/:id
router.put('/:id', requireRole('super_admin', 'admin', 'teacher'), (req, res) => {
  try {
    const db = getDb();
    const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!s) return res.status(404).json(errorRes(404, '签到会话不存在'));
    const { title, session_date, start_time, end_time, late_threshold_min, auto_end_min } = req.body;
    db.prepare('UPDATE sessions SET title=?, session_date=?, start_time=?, end_time=?, late_threshold_min=?, auto_end_min=?, updated_at=? WHERE id=?').run(
      title ?? s.title, session_date ?? s.session_date, start_time ?? s.start_time,
      end_time ?? s.end_time, late_threshold_min ?? s.late_threshold_min, auto_end_min ?? s.auto_end_min, nowStr(), req.params.id
    );
    const updated = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    res.json(successRes(updated, '更新成功'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// POST /sessions/:id/start
router.post('/:id/start', requireRole('super_admin', 'admin', 'teacher'), (req, res) => {
  try {
    const db = getDb();
    const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!s) return res.status(404).json(errorRes(404, '签到会话不存在'));
    if (s.status !== 'scheduled') return res.status(400).json(errorRes(400, '当前状态无法开始签到'));
    const qrToken = uuid();
    const expiresAt = new Date(Date.now() + (s.auto_end_min || 60) * 60000).toISOString();
    db.prepare("UPDATE sessions SET status='active', qr_token=?, qr_expires_at=?, updated_at=? WHERE id=?").run(qrToken, expiresAt, nowStr(), req.params.id);
    // Create attendance records for all students in the class
    const students = db.prepare('SELECT user_id FROM class_students WHERE class_id = ?').all(s.class_id);
    const insert = db.prepare('INSERT OR IGNORE INTO attendance_records (session_id, user_id, class_id, course_id, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)');
    const t = nowStr();
    const txn = db.transaction(() => {
      for (const st of students) {
        insert.run(s.id, st.user_id, s.class_id, s.course_id, 'absent', t, t);
      }
    });
    txn();
    // Send checkin reminder notifications to all students in the class
    const course = db.prepare('SELECT name FROM courses WHERE id = ?').get(s.course_id);
    for (const st of students) {
      const nr = db.prepare(`
        INSERT INTO notifications (user_id, type, title, content, link, created_at)
        VALUES (?, 'checkin_reminder', ?, ?, '/check-in', ?)
      `).run(st.user_id, '签到提醒', `「${course?.name || ''}」课程签到已开始，请及时签到`, t);
      const n = db.prepare('SELECT * FROM notifications WHERE id = ?').get(nr.lastInsertRowid);
      pushNotificationToUser(st.user_id, n);
    }
    res.json(successRes({ qr_token: qrToken, expires_at: expiresAt }, '签到已开始'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// POST /sessions/:id/end
router.post('/:id/end', requireRole('super_admin', 'admin', 'teacher'), (req, res) => {
  try {
    const db = getDb();
    const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!s) return res.status(404).json(errorRes(404, '签到会话不存在'));
    if (s.status !== 'active') return res.status(400).json(errorRes(400, '当前状态无法结束签到'));
    db.prepare("UPDATE sessions SET status='ended', qr_token='', updated_at=? WHERE id=?").run(nowStr(), req.params.id);
    res.json(successRes(null, '签到已结束'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// DELETE /sessions/:id
router.delete('/:id', requireRole('super_admin', 'admin', 'teacher'), (req, res) => {
  try {
    const db = getDb();
    const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
    if (!s) return res.status(404).json(errorRes(404, '签到会话不存在'));
    db.prepare("UPDATE sessions SET status='cancelled', updated_at=? WHERE id=?").run(nowStr(), req.params.id);
    res.json(successRes(null, '已取消'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

export default router;
