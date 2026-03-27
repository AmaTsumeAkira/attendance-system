import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { successRes, errorRes, nowStr } from '../utils/helpers.js';

const router = Router();
router.use(authMiddleware);

// GET /schedules
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { course_id, class_id, semester } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (course_id) { where += ' AND st.course_id = ?'; params.push(course_id); }
    if (class_id) { where += ' AND st.class_id = ?'; params.push(class_id); }
    if (semester) { where += ' AND st.semester = ?'; params.push(semester); }
    const items = db.prepare(`
      SELECT st.*, c.name as course_name, cl.name as class_name
      FROM schedule_templates st
      LEFT JOIN courses c ON st.course_id = c.id
      LEFT JOIN classes cl ON st.class_id = cl.id
      ${where} ORDER BY st.day_of_week, st.start_time
    `).all(...params);
    res.json(successRes(items));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// POST /schedules
router.post('/', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const { course_id, class_id, semester, day_of_week, start_time, end_time, location } = req.body;
    if (!course_id || !class_id || !semester) {
      return res.status(400).json(errorRes(400, 'course_id, class_id, semester 为必填项'));
    }
    const db = getDb();
    const t = nowStr();
    const r = db.prepare('INSERT INTO schedule_templates (course_id, class_id, semester, day_of_week, start_time, end_time, location, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(
      course_id, class_id, semester, day_of_week || 1, start_time || '08:00', end_time || '09:40', location || '', t, t
    );
    res.json(successRes({ id: r.lastInsertRowid }, '创建成功'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// PUT /schedules/:id
router.put('/:id', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const db = getDb();
    const s = db.prepare('SELECT * FROM schedule_templates WHERE id = ?').get(req.params.id);
    if (!s) return res.status(404).json(errorRes(404, '课表模板不存在'));
    const { day_of_week, start_time, end_time, location } = req.body;
    db.prepare('UPDATE schedule_templates SET day_of_week=?, start_time=?, end_time=?, location=?, updated_at=? WHERE id=?').run(
      day_of_week ?? s.day_of_week, start_time ?? s.start_time, end_time ?? s.end_time, location ?? s.location, nowStr(), req.params.id
    );
    const updated = db.prepare('SELECT * FROM schedule_templates WHERE id = ?').get(req.params.id);
    res.json(successRes(updated, '更新成功'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// DELETE /schedules/:id
router.delete('/:id', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM schedule_templates WHERE id = ?').run(req.params.id);
    res.json(successRes(null, '已删除'));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

// POST /schedules/generate
router.post('/generate', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const { semester, startDate, endDate } = req.body;
    if (!semester || !startDate || !endDate) {
      return res.status(400).json(errorRes(400, 'semester, startDate, endDate 为必填项'));
    }
    const db = getDb();
    const templates = db.prepare('SELECT * FROM schedule_templates WHERE semester = ?').all(semester);
    if (!templates.length) return res.json(successRes({ created: 0 }, '没有找到该学期的课表模板'));
    const dayMap = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6 }; // ISO to JS day offset
    let created = 0;
    const insert = db.prepare(`
      INSERT OR IGNORE INTO sessions (course_id, class_id, title, session_date, start_time, end_time, status, late_threshold_min, auto_end_min, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const txn = db.transaction(() => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const jsDay = d.getDay(); // 0=Sun
        const isoDay = jsDay === 0 ? 7 : jsDay; // 1=Mon...7=Sun
        for (const tpl of templates) {
          if (tpl.day_of_week === isoDay) {
            const dateStr = d.toISOString().slice(0, 10);
            const t = nowStr();
            try {
              insert.run(tpl.course_id, tpl.class_id, '', dateStr, tpl.start_time, tpl.end_time, 'scheduled', 10, 60, null, t, t);
              created++;
            } catch { /* ignore duplicates */ }
          }
        }
      }
    });
    txn();
    res.json(successRes({ created }, `成功生成 ${created} 个签到会话`));
  } catch (err) { res.status(500).json(errorRes(500, err.message)); }
});

export default router;
