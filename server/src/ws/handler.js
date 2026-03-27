import jwt from 'jsonwebtoken';
import { getDb } from '../db.js';
import { nowStr } from '../utils/helpers.js';

// session subscriptions: sessionId -> Set<ws>
const sessionSubs = new Map();
// ws -> Set<sessionId>
const wsSubs = new Map();
// user connections: userId -> Set<ws>
const userConns = new Map();

// Push notification to a specific user via WebSocket
export function pushNotificationToUser(userId, notification) {
  const conns = userConns.get(userId);
  if (!conns) return;
  const msg = JSON.stringify({ type: 'notification', payload: notification });
  for (const ws of conns) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

export function handleWsConnection(ws, req) {
  // Auth via query param
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  let user;
  try {
    user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
  } catch {
    ws.send(JSON.stringify({ type: 'error', payload: { message: '认证失败' } }));
    ws.close(4001, 'Unauthorized');
    return;
  }

  ws.user = user;
  ws.isAlive = true;
  wsSubs.set(ws, new Set());

  // Track user connections for notification push
  if (!userConns.has(user.id)) userConns.set(user.id, new Set());
  userConns.get(user.id).add(ws);

  // Update online status
  try {
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO user_status (user_id, online, last_seen) VALUES (?,?,?)').run(user.id, 1, nowStr());
  } catch {}

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      handleMessage(ws, msg);
    } catch {
      ws.send(JSON.stringify({ type: 'error', payload: { message: '消息格式错误' } }));
    }
  });

  ws.on('close', () => {
    const subs = wsSubs.get(ws);
    if (subs) {
      for (const sid of subs) {
        const s = sessionSubs.get(sid);
        if (s) { s.delete(ws); if (!s.size) sessionSubs.delete(sid); }
      }
    }
    wsSubs.delete(ws);
    // Clean up user connection tracking
    const uc = userConns.get(user.id);
    if (uc) { uc.delete(ws); if (!uc.size) userConns.delete(user.id); }
    try {
      const db = getDb();
      db.prepare('UPDATE user_status SET online=0, last_seen=? WHERE user_id=?').run(nowStr(), user.id);
    } catch {}
  });

  ws.send(JSON.stringify({ type: 'connected', payload: { userId: user.id, username: user.username } }));
}

function handleMessage(ws, msg) {
  switch (msg.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
    case 'subscribe':
      handleSubscribe(ws, msg);
      break;
    case 'check_in':
      handleCheckIn(ws, msg);
      break;
    case 'get_stats':
      handleGetStats(ws, msg);
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', payload: { message: `未知消息类型: ${msg.type}` } }));
  }
}

function handleSubscribe(ws, msg) {
  const { sessionId } = msg.payload || {};
  if (!sessionId) return ws.send(JSON.stringify({ type: 'error', payload: { message: '缺少sessionId' } }));
  if (!sessionSubs.has(sessionId)) sessionSubs.set(sessionId, new Set());
  sessionSubs.get(sessionId).add(ws);
  wsSubs.get(ws).add(sessionId);
  ws.send(JSON.stringify({ type: 'subscribed', payload: { sessionId } }));
}

function handleCheckIn(ws, msg) {
  const { token, sessionId } = msg.payload || {};
  const reqId = msg.reqId;
  if (!token || !sessionId) {
    return ws.send(JSON.stringify({ type: 'check_in_result', payload: { success: false, message: '参数不完整' }, reqId }));
  }
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) {
    return ws.send(JSON.stringify({ type: 'check_in_result', payload: { success: false, message: '签到会话不存在' }, reqId }));
  }
  if (session.status !== 'active') {
    return ws.send(JSON.stringify({ type: 'check_in_result', payload: { success: false, message: '签到未开始或已结束' }, reqId }));
  }
  if (session.qr_token !== token) {
    return ws.send(JSON.stringify({ type: 'check_in_result', payload: { success: false, message: '签到码无效' }, reqId }));
  }
  if (session.qr_expires_at && new Date(session.qr_expires_at) < new Date()) {
    return ws.send(JSON.stringify({ type: 'check_in_result', payload: { success: false, message: '签到码已过期' }, reqId }));
  }

  // Check if student is in the class
  const inClass = db.prepare('SELECT id FROM class_students WHERE class_id = ? AND user_id = ?').get(session.class_id, ws.user.id);
  if (!inClass && ws.user.role === 'student') {
    return ws.send(JSON.stringify({ type: 'check_in_result', payload: { success: false, message: '你不属于该班级' }, reqId }));
  }

  // Determine status (late?)
  let status = 'present';
  if (session.start_time) {
    const now = new Date();
    const [h, m] = session.start_time.split(':').map(Number);
    const startMinutes = h * 60 + m;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes - startMinutes > (session.late_threshold_min || 10)) {
      status = 'late';
    }
  }

  const t = nowStr();
  const existing = db.prepare('SELECT * FROM attendance_records WHERE session_id = ? AND user_id = ?').get(sessionId, ws.user.id);
  if (existing) {
    if (existing.status === 'present' || existing.status === 'late') {
      return ws.send(JSON.stringify({ type: 'check_in_result', payload: { success: false, status: existing.status, message: '已签到' }, reqId }));
    }
    db.prepare("UPDATE attendance_records SET status=?, check_in_time=?, check_in_method='qr', updated_at=? WHERE id=?").run(status, t, t, existing.id);
  } else {
    db.prepare("INSERT INTO attendance_records (session_id, user_id, class_id, course_id, status, check_in_time, check_in_method, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)").run(
      sessionId, ws.user.id, session.class_id, session.course_id, status, t, 'qr', t, t
    );
  }

  ws.send(JSON.stringify({ type: 'check_in_result', payload: { success: true, status, message: status === 'late' ? '迟到签到成功' : '签到成功' }, reqId }));

  // Broadcast to session subscribers
  const user = db.prepare('SELECT real_name FROM users WHERE id = ?').get(ws.user.id);
  broadcastToSession(sessionId, {
    type: 'user_checked_in',
    payload: { userId: ws.user.id, name: user?.real_name || '', status, time: t }
  });

  // Send updated stats
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) as checkedIn
    FROM attendance_records WHERE session_id = ?
  `).get(sessionId);
  const recentUsers = db.prepare(`
    SELECT u.real_name as name, ar.status, ar.check_in_time as time
    FROM attendance_records ar JOIN users u ON ar.user_id = u.id
    WHERE ar.session_id = ? AND ar.status IN ('present','late')
    ORDER BY ar.check_in_time DESC LIMIT 5
  `).all(sessionId);
  broadcastToSession(sessionId, {
    type: 'session_update',
    payload: { sessionId, status: session.status, checkedIn: stats.checkedIn, total: stats.total, recentUsers }
  });
}

function handleGetStats(ws, msg) {
  const { sessionId } = msg.payload || {};
  if (!sessionId) return;
  const db = getDb();
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
      SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave
    FROM attendance_records WHERE session_id = ?
  `).get(sessionId);
  ws.send(JSON.stringify({ type: 'stats_update', payload: { sessionId, ...stats } }));
}

function broadcastToSession(sessionId, data) {
  const subs = sessionSubs.get(sessionId);
  if (!subs) return;
  const msg = JSON.stringify(data);
  for (const ws of subs) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// Heartbeat interval
let heartbeatTimer;

export function startHeartbeat(wss) {
  heartbeatTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);
}

export function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
}
