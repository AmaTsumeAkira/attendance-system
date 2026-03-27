import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import { getDb } from './db.js';
import { handleWsConnection, startHeartbeat, stopHeartbeat } from './ws/handler.js';
import { successRes, errorRes } from './utils/helpers.js';

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

// HTTP + WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', handleWsConnection);
startHeartbeat(wss);

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket on ws://localhost:${PORT}/ws`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  stopHeartbeat();
  wss.close();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopHeartbeat();
  wss.close();
  server.close();
  process.exit(0);
});
