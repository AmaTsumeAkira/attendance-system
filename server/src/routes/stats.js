import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { successRes, errorRes, todayStr } from '../utils/helpers.js';

const router = Router();
router.use(authMiddleware);

// GET /stats/overview
router.get('/overview', (req, res) => {
  try {
    const db = getDb();
    const date = req.query.date || todayStr();
    const totalStudents = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'student' AND status = 'active'").get().c;
    const todaySessions = db.prepare('SELECT COUNT(*) as c FROM sessions WHERE session_date = ?').get(date).c;
    const activeSessions = db.prepare("SELECT COUNT(*) as c FROM sessions WHERE session_date = ? AND status = 'active'").get(date).c;
    const todayRecords = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN ar.status = 'leave' THEN 1 ELSE 0 END) as leave
      FROM attendance_records ar
      JOIN sessions s ON ar.session_id = s.id
      WHERE s.session_date = ?
    `).get(date);
    const pendingLeaves = db.prepare("SELECT COUNT(*) as c FROM leave_requests WHERE status = 'pending'").get().c;
    res.json(successRes({
      date,
      total_students: totalStudents,
      today_sessions: todaySessions,
      active_sessions: activeSessions,
      attendance: todayRecords,
      pending_leaves: pendingLeaves
    }));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// GET /stats/class/:id
router.get('/class/:id', (req, res) => {
  try {
    const db = getDb();
    const { start, end } = req.query;
    let dateFilter = '';
    const params = [req.params.id];
    if (start) { dateFilter += ' AND s.session_date >= ?'; params.push(start); }
    if (end) { dateFilter += ' AND s.session_date <= ?'; params.push(end); }
    const stats = db.prepare(`
      SELECT
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(ar.id) as total_records,
        SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN ar.status = 'leave' THEN 1 ELSE 0 END) as leave
      FROM sessions s
      LEFT JOIN attendance_records ar ON s.id = ar.session_id
      WHERE s.class_id = ? ${dateFilter}
    `).get(...params);
    const studentStats = db.prepare(`
      SELECT u.id, u.real_name, u.student_id,
        COUNT(ar.id) as total,
        SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN ar.status = 'leave' THEN 1 ELSE 0 END) as leave
      FROM class_students cs
      JOIN users u ON cs.user_id = u.id
      LEFT JOIN attendance_records ar ON u.id = ar.user_id
      LEFT JOIN sessions s ON ar.session_id = s.id AND s.class_id = ? ${dateFilter.replace(/s\./g, 's.')}
      WHERE cs.class_id = ?
      GROUP BY u.id
    `).all(req.params.id, ...(start ? [start] : []), ...(end ? [end] : []), req.params.id);
    res.json(successRes({ summary: stats, students: studentStats }));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// GET /stats/course/:id
router.get('/course/:id', (req, res) => {
  try {
    const db = getDb();
    const { start, end } = req.query;
    let dateFilter = '';
    const params = [req.params.id];
    if (start) { dateFilter += ' AND s.session_date >= ?'; params.push(start); }
    if (end) { dateFilter += ' AND s.session_date <= ?'; params.push(end); }
    const stats = db.prepare(`
      SELECT
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(ar.id) as total_records,
        SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN ar.status = 'leave' THEN 1 ELSE 0 END) as leave
      FROM sessions s
      LEFT JOIN attendance_records ar ON s.id = ar.session_id
      WHERE s.course_id = ? ${dateFilter}
    `).get(...params);
    res.json(successRes(stats));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// GET /stats/ranking?month=2026-03
router.get('/ranking', (req, res) => {
  try {
    const db = getDb();
    const month = req.query.month || todayStr().slice(0, 7);
    const items = db.prepare(`
      SELECT u.id as userId, u.real_name as realName, u.student_id as studentId,
        SUM(CASE WHEN ar.status IN ('present','late') THEN 1 ELSE 0 END) as presentDays,
        COUNT(ar.id) as totalDays,
        CASE WHEN COUNT(ar.id) > 0
          THEN ROUND(CAST(SUM(CASE WHEN ar.status IN ('present','late') THEN 1 ELSE 0 END) AS REAL) / COUNT(ar.id) * 100, 1)
          ELSE 0 END as rate
      FROM users u
      JOIN attendance_records ar ON u.id = ar.user_id
      JOIN sessions s ON ar.session_id = s.id
      WHERE u.role = 'student' AND u.status = 'active'
        AND strftime('%Y-%m', s.session_date) = ?
      GROUP BY u.id
      ORDER BY rate DESC, presentDays DESC
    `).all(month);
    res.json(successRes({ items }));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// GET /stats/student/:id
router.get('/student/:id', (req, res) => {
  try {
    const db = getDb();
    const { month } = req.query;
    let dateFilter = '';
    const params = [req.params.id];
    if (month) { dateFilter = "AND strftime('%Y-%m', s.session_date) = ?"; params.push(month); }
    const stats = db.prepare(`
      SELECT
        COUNT(ar.id) as total,
        SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN ar.status = 'leave' THEN 1 ELSE 0 END) as leave
      FROM attendance_records ar
      JOIN sessions s ON ar.session_id = s.id
      WHERE ar.user_id = ? ${dateFilter}
    `).get(...params);
    const rate = stats.total > 0 ? ((stats.present + stats.late) / stats.total * 100).toFixed(1) : 0;
    res.json(successRes({ ...stats, rate: Number(rate) }));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

export default router;
