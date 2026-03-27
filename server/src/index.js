import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import { getDb } from './db.js';
import { handleWsConnection, startHeartbeat, stopHeartbeat } from './ws/handler.js';
import { successRes, errorRes, todayStr, nowStr } from './utils/helpers.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import classRoutes from './routes/classes.js';
import gradeRoutes from './routes/grades.js';
import courseRoutes from './routes/courses.js';
import sessionRoutes from './routes/sessions.js';
import attendanceRoutes from './routes/attendance.js';
import statsRoutes from './routes/stats.js';
import leaveRoutes from './routes/leaves.js';
import scheduleRoutes from './routes/schedules.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Initialize DB
getDb();

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/classes', classRoutes);
app.use('/api/v1/grades', gradeRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/attendances', attendanceRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/leaves', leaveRoutes);
app.use('/api/v1/schedules', scheduleRoutes);

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json(successRes({ status: 'ok', time: new Date().toISOString() }));
});

// 404
app.use((req, res) => {
  res.status(404).json(errorRes(404, '接口不存在'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json(errorRes(500, '服务器内部错误'));
});

// ── Cron job (setInterval, 60s) ──
let cronInterval = null;

function startCronJobs() {
  cronInterval = setInterval(() => {
    try {
      const db = getDb();
      const now = new Date();
      const today = todayStr();
      const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon..7=Sun
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM

      // 1. Auto-create sessions from schedule_templates for today
      const templates = db.prepare(`
        SELECT st.* FROM schedule_templates st
        WHERE st.day_of_week = ?
      `).all(dayOfWeek);
      for (const tpl of templates) {
        const exists = db.prepare(
          "SELECT id FROM sessions WHERE course_id=? AND class_id=? AND session_date=? AND start_time=?"
        ).get(tpl.course_id, tpl.class_id, today, tpl.start_time);
        if (!exists) {
          db.prepare(`
            INSERT INTO sessions (course_id, class_id, title, session_date, start_time, end_time, status, auto_end_min)
            VALUES (?, ?, ?, ?, ?, ?, 'scheduled', 60)
          `).run(tpl.course_id, tpl.class_id, tpl.location ? `${tpl.location}` : '', today, tpl.start_time, tpl.end_time);
          // Create attendance records for all students in the class
          const newSession = db.prepare("SELECT id FROM sessions WHERE course_id=? AND class_id=? AND session_date=? AND start_time=?").get(tpl.course_id, tpl.class_id, today, tpl.start_time);
          const students = db.prepare('SELECT user_id FROM class_students WHERE class_id = ?').all(tpl.class_id);
          for (const s of students) {
            db.prepare('INSERT OR IGNORE INTO attendance_records (session_id, user_id, class_id, course_id) VALUES (?, ?, ?, ?)').run(
              newSession.id, s.user_id, tpl.class_id, tpl.course_id
            );
          }
        }
      }

      // 2. Activate scheduled sessions whose start_time has passed
      db.prepare(`
        UPDATE sessions SET status = 'active', updated_at = datetime('now','localtime')
        WHERE status = 'scheduled' AND session_date = ? AND start_time <= ?
      `).run(today, currentTime);

      // 3. End active sessions past end_time + auto_end_min, mark absent
      const endedSessions = db.prepare(`
        SELECT id, end_time, auto_end_min FROM sessions
        WHERE status = 'active' AND session_date = ?
      `).all(today);
      for (const s of endedSessions) {
        const [eh, em] = s.end_time.split(':').map(Number);
        const endTotalMin = eh * 60 + em + (s.auto_end_min || 60);
        const [ch, cm] = currentTime.split(':').map(Number);
        const currentTotalMin = ch * 60 + cm;
        if (currentTotalMin > endTotalMin) {
          db.prepare("UPDATE sessions SET status = 'ended', updated_at = datetime('now','localtime') WHERE id = ?").run(s.id);
          // Mark unchecked students as absent
          db.prepare("UPDATE attendance_records SET status = 'absent', updated_at = datetime('now','localtime') WHERE session_id = ? AND status = 'absent' AND check_in_time IS NULL").run(s.id);
        }
      }
    } catch (err) {
      console.error('[cron] Error:', err.message);
    }
  }, 60000);
}

// HTTP + WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', handleWsConnection);
startHeartbeat(wss);

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket on ws://localhost:${PORT}/ws`);
  startCronJobs();
  console.log('⏱️  Cron jobs started (60s interval)');
});

// Graceful shutdown
process.on('SIGINT', () => {
  if (cronInterval) clearInterval(cronInterval);
  stopHeartbeat();
  wss.close();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (cronInterval) clearInterval(cronInterval);
  stopHeartbeat();
  wss.close();
  server.close();
  process.exit(0);
});
