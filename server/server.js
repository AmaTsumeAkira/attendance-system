require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const db = require('./config/db');

const app = express();
const server = app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Server running on port', process.env.PORT || 3000));
const wss = new WebSocket.Server({
  server,
  path: '/ws',
  maxPayload: 64 * 1024,
  verifyClient: (info, cb) => {
    const origin = info.req.headers.origin || '';
    const allowedOrigins = [
      `http://localhost:${process.env.PORT || 3000}`,
      `https://localhost:${process.env.PORT || 3000}`,
      `http://127.0.0.1:${process.env.PORT || 3000}`,
      `https://127.0.0.1:${process.env.PORT || 3000}`
    ];
    // 允许服务端自身域名
    if (info.req.headers.host) {
      allowedOrigins.push(`http://${info.req.headers.host}`);
      allowedOrigins.push(`https://${info.req.headers.host}`);
    }
    // 允许通过 SERVER_ORIGIN 环境变量额外指定的域名
    if (process.env.SERVER_ORIGIN) {
      allowedOrigins.push(process.env.SERVER_ORIGIN);
    }
    // 无 Origin（非浏览器客户端如 curl/Node.js）放行
    if (!origin || allowedOrigins.some(a => origin === a)) {
      cb(true);
    } else {
      console.warn(`WebSocket 连接被拒绝，Origin: ${origin}`);
      cb(false, 403, 'Forbidden');
    }
  }
});

if (!process.env.ADMIN_PASSWORD) {
  console.error('❌ 缺少必要的环境变量: ADMIN_PASSWORD');
  console.error('请在 .env 文件中配置该变量，参考 .env.example');
  process.exit(1);
}
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// 服务端防重复签到：用户ID -> 上次提交时间戳
const lastSubmitMap = new Map();
const DEDUP_WINDOW = 10000; // 10秒
const MAX_DEDUP_ENTRIES = 10000; // 最大条目数，防止内存泄漏

// ===== WebSocket 心跳保活 =====
const HEARTBEAT_INTERVAL = 30000; // 30秒
const PONG_TIMEOUT = 10000; // 10秒无响应视为断开

const heartbeatTimer = setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) {
      return ws.terminate(); // 无响应，断开连接
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => clearInterval(heartbeatTimer));
wss.on('error', (err) => {
  console.error('WebSocket server error:', err.message);
});

// ===== WebSocket 消息速率限制 =====
const RATE_LIMIT_WINDOW = 1000; // 1 秒窗口
const RATE_LIMIT_MAX = 10; // 每秒最多 10 条消息

function checkRateLimit(ws) {
  const now = Date.now();
  if (!ws._rateLimitReset || now > ws._rateLimitReset) {
    ws._rateLimitReset = now + RATE_LIMIT_WINDOW;
    ws._rateLimitCount = 0;
  }
  ws._rateLimitCount++;
  if (ws._rateLimitCount > RATE_LIMIT_MAX) {
    ws.send(JSON.stringify({ type: 'error', message: '消息发送过于频繁，请稍后再试' }));
    return false;
  }
  return true;
}

app.use(express.static(path.join(__dirname, '../client/public')));
app.use(express.json());

function formatLocalDateTime() {
  return new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-');
}

function getLocalDate() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

wss.on('connection', (ws) => {
  // 心跳检测
  ws.isAlive = true;
  ws.isAuthenticated = false; // 管理员认证状态
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err.message);
  });

  ws.on('message', async (message) => {
    // 速率限制检查
    if (!checkRateLimit(ws)) return;

    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: '无效的消息格式，无法解析 JSON' }));
      return;
    }

    // ===== 管理员认证 =====
    if (data.type === 'auth') {
      if (data.password === ADMIN_PASSWORD) {
        ws.isAuthenticated = true;
        ws.send(JSON.stringify({ type: 'authSuccess', message: '认证成功' }));
      } else {
        ws.send(JSON.stringify({ type: 'authFailed', message: '密码错误' }));
      }
      return;
    }

    // 需要管理员权限的操作列表
    const adminOnlyTypes = ['getAttendanceStats', 'getAttendanceByDate', 'exportCSV', 'clearQRCode'];
    if (adminOnlyTypes.includes(data.type) && !ws.isAuthenticated) {
      ws.send(JSON.stringify({ type: 'error', message: '未认证，请先完成管理员验证' }));
      return;
    }

    // submitAttendance 也需要认证
    if (data.type === 'submitAttendance' && !ws.isAuthenticated) {
      ws.send(JSON.stringify({ type: 'error', message: '未认证，无法提交签到' }));
      return;
    }

    if (data.type === 'checkAttendance') {
      const uid = Number(data.userId);
      if (!Number.isFinite(uid) || uid <= 0) {
        ws.send(JSON.stringify({ type: 'error', message: '无效的用户ID' }));
        return;
      }
      ws.userId = uid;
      const [rows] = await db.query(
        'SELECT * FROM attendance_records WHERE f_n2a666hq2br = ? AND f_29yzstin559 = ?',
        [getLocalDate(), uid]
      );
      if (rows.length > 0) {
        // 将内部字段名转为公开字段名，与 attendanceUpdated 格式一致
        const row = rows[0];
        ws.send(JSON.stringify({
          type: 'attendanceStatus',
          data: { status: row.f_0kiw0ulq188, updated_at: row.updated_at }
        }));
      } else {
        ws.send(JSON.stringify({ type: 'attendanceStatus', data: null }));
      }
    }

    if (data.type === 'submitAttendance') {
      const { userId, adminId, status, studentInfo, timestamp } = data;
      // 输入验证
      if (!userId || !adminId || !status || !timestamp) {
        ws.send(JSON.stringify({ type: 'error', message: '缺少必要参数 (userId, adminId, status, timestamp)' }));
        return;
      }
      const numUserId = Number(userId);
      const numAdminId = Number(adminId);
      if (!Number.isFinite(numUserId) || numUserId <= 0 || !Number.isFinite(numAdminId) || numAdminId <= 0) {
        ws.send(JSON.stringify({ type: 'error', message: '无效的用户ID或管理员ID' }));
        return;
      }
      const validStatuses = ['present', 'absent', 'late', 'leave'];
      if (!validStatuses.includes(status)) {
        ws.send(JSON.stringify({ type: 'error', message: '无效的签到状态' }));
        return;
      }

      // 服务端防重复签到（10秒时间窗口）
      const nowTs = Date.now();
      const lastSubmit = lastSubmitMap.get(numUserId);
      if (lastSubmit && (nowTs - lastSubmit) < DEDUP_WINDOW) {
        const remaining = Math.ceil((DEDUP_WINDOW - (nowTs - lastSubmit)) / 1000);
        ws.send(JSON.stringify({ type: 'error', message: `用户 ${numUserId} 提交过于频繁，请等待 ${remaining} 秒后再试` }));
        return;
      }
      lastSubmitMap.set(numUserId, nowTs);

      try {
        const currentTime = Date.now();
        const qrTimestamp = Number(timestamp);

        // Validate timestamp (e.g., must be within 15 seconds)
        const timeDifference = (currentTime - qrTimestamp) / 1000; // Convert to seconds
        if (timeDifference > 15) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: '二维码已过期，请使用最新的二维码签到' 
          }));
          return;
        }

        const today = getLocalDate();
        const currentTimeFormatted = formatLocalDateTime();

        const [existing] = await db.query(
          'SELECT f_k1x5891pt2x FROM user_status WHERE id = ?',
          [numUserId]
        );

        if (existing.length === 0) {
          ws.send(JSON.stringify({ type: 'error', message: `用户 ${numUserId} 在 user_status 中无记录，无法签到` }));
          return;
        }

        // 验证管理员 ID 存在
        const [adminExists] = await db.query(
          'SELECT id FROM user_status WHERE id = ?',
          [numAdminId]
        );
        if (adminExists.length === 0) {
          ws.send(JSON.stringify({ type: 'error', message: `管理员 ${numAdminId} 不存在` }));
          return;
        }

        const oldStatus = existing[0].f_k1x5891pt2x;
        if (oldStatus !== status) {
          await db.query(
            'UPDATE user_status SET f_k1x5891pt2x = ?, updated_at = ? WHERE id = ?',
            [status, currentTimeFormatted, numUserId]
          );
        }

        const [existingAttendance] = await db.query(
          'SELECT id, f_0kiw0ulq188 FROM attendance_records WHERE f_n2a666hq2br = ? AND f_29yzstin559 = ? LIMIT 1',
          [today, numUserId]
        );

        const attendanceDataPublic = {
          userId: numUserId,
          status: status,
          updated_at: currentTimeFormatted
        };

        if (existingAttendance.length > 0) {
          const oldRecordStatus = existingAttendance[0].f_0kiw0ulq188;
          if (oldRecordStatus !== status) {
            await db.query(
              'UPDATE attendance_records SET f_0kiw0ulq188 = ?, created_by_id = ?, updated_at = ? WHERE id = ?',
              [status, numAdminId, currentTimeFormatted, existingAttendance[0].id]
            );
            // 状态已更新，发送成功响应给管理员
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'attendanceUpdated', data: attendanceDataPublic, studentInfo, changed: true }));
            }
            // 广播给学生端，实现实时状态更新
            wss.clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN && client.userId === numUserId) {
                client.send(JSON.stringify({ type: 'attendanceUpdated', data: attendanceDataPublic }));
              }
            });
          } else {
            // 状态未变化，提示管理员避免误操作
            ws.send(JSON.stringify({ type: 'duplicateAttendance', userId: numUserId, studentInfo, message: `用户 ${studentInfo?.name || numUserId} 今日已签到（${status}），无需重复操作` }));
          }
        } else {
          await db.query(
            'INSERT INTO attendance_records (f_n2a666hq2br, f_29yzstin559, f_0kiw0ulq188, created_by_id, updated_at) VALUES (?, ?, ?, ?, ?)',
            [today, numUserId, status, numAdminId, currentTimeFormatted]
          );
          // 新记录，发送成功响应给管理员
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'attendanceUpdated', data: attendanceDataPublic, studentInfo }));
          }
          // 广播给学生端，实现实时状态更新
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && client.userId === numUserId) {
              client.send(JSON.stringify({ type: 'attendanceUpdated', data: attendanceDataPublic }));
            }
          });
        }
      } catch (error) {
        console.error('Database error:', error);
        ws.send(JSON.stringify({ type: 'error', message: '数据库写入失败: ' + error.message }));
      }
    }

    if (data.type === 'clearQRCode') {
      const uid = Number(data.userId);
      if (!Number.isFinite(uid) || uid <= 0) {
        ws.send(JSON.stringify({ type: 'error', message: '无效的用户ID' }));
        return;
      }
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.userId === uid) {
          client.send(JSON.stringify({ type: 'clearQRCode', userId: uid }));
        }
      });
    }

    if (data.type === 'getAttendanceStats') {
      try {
        const today = getLocalDate();

        // 今日统计
        const [todayStats] = await db.query(
          `SELECT f_0kiw0ulq188 AS status, COUNT(*) AS count
           FROM attendance_records WHERE f_n2a666hq2br = ?
           GROUP BY f_0kiw0ulq188`, [today]
        );

        // 总用户数
        const [totalUsers] = await db.query('SELECT COUNT(*) AS total FROM user_status');

        // 签到排行榜（历史总出勤天数 Top 10）
        const [leaderboard] = await db.query(
          `SELECT ar.f_29yzstin559 AS userId, COUNT(*) AS presentDays
           FROM attendance_records ar
           WHERE ar.f_0kiw0ulq188 = 'present'
           GROUP BY ar.f_29yzstin559
           ORDER BY presentDays DESC
           LIMIT 10`
        );

        // 今日出勤详情
        const [todayDetails] = await db.query(
          `SELECT f_29yzstin559 AS userId, f_0kiw0ulq188 AS status, updated_at
           FROM attendance_records WHERE f_n2a666hq2br = ?
           ORDER BY updated_at ASC`, [today]
        );

        const signedCount = todayStats.reduce((sum, s) => sum + Number(s.count), 0);
        const uncheckedCount = Number(totalUsers[0].total) - signedCount;

        ws.send(JSON.stringify({
          type: 'attendanceStats',
          data: {
            today,
            stats: todayStats,
            totalUsers: totalUsers[0].total,
            uncheckedCount,
            leaderboard,
            todayDetails
          }
        }));
      } catch (error) {
        console.error('Stats query error:', error);
        ws.send(JSON.stringify({ type: 'error', message: '获取统计数据失败: ' + error.message }));
      }
    }

    // ===== 按日期查询签到记录 =====
    if (data.type === 'getAttendanceByDate') {
      try {
        const date = data.date || getLocalDate();
        // 日期格式校验 (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          ws.send(JSON.stringify({ type: 'error', message: '日期格式不正确，应为 YYYY-MM-DD' }));
          return;
        }

        const [records] = await db.query(
          `SELECT ar.f_29yzstin559 AS userId, ar.f_0kiw0ulq188 AS status, ar.updated_at
           FROM attendance_records ar
           WHERE ar.f_n2a666hq2br = ?
           ORDER BY ar.updated_at ASC`, [date]
        );

        const [totalUsers] = await db.query('SELECT COUNT(*) AS total FROM user_status');

        // 统计各状态人数
        const [dayStats] = await db.query(
          `SELECT f_0kiw0ulq188 AS status, COUNT(*) AS count
           FROM attendance_records WHERE f_n2a666hq2br = ?
           GROUP BY f_0kiw0ulq188`, [date]
        );

        ws.send(JSON.stringify({
          type: 'attendanceByDate',
          data: { date, records, totalUsers: totalUsers[0].total, stats: dayStats }
        }));
      } catch (error) {
        console.error('Date query error:', error);
        ws.send(JSON.stringify({ type: 'error', message: '查询日期记录失败: ' + error.message }));
      }
    }

    // ===== CSV 导出签到记录 =====
    if (data.type === 'exportCSV') {
      try {
        const { startDate, endDate } = data;
        const start = startDate || getLocalDate();
        const end = endDate || getLocalDate();
        // 日期格式校验
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(start) || !dateRegex.test(end)) {
          ws.send(JSON.stringify({ type: 'error', message: '日期格式不正确，应为 YYYY-MM-DD' }));
          return;
        }
        if (start > end) {
          ws.send(JSON.stringify({ type: 'error', message: '起始日期不能晚于结束日期' }));
          return;
        }

        const [records] = await db.query(
          `SELECT ar.f_n2a666hq2br AS date, ar.f_29yzstin559 AS userId, 
                  ar.f_0kiw0ulq188 AS status, ar.created_by_id AS adminId, ar.updated_at
           FROM attendance_records ar
           WHERE ar.f_n2a666hq2br BETWEEN ? AND ?
           ORDER BY ar.f_n2a666hq2br ASC, ar.updated_at ASC`,
          [start, end]
        );

        const statusLabelMap = { present: '出勤', absent: '缺勤', late: '迟到', leave: '请假' };
        // CSV 字段转义：防止逗号、引号、换行符破坏格式，同时防止 CSV 注入
        function escapeCSV(val) {
          if (val === null || val === undefined) return '';
          const str = String(val);
          // 以 =、+、-、@、\t、\r 开头可能导致公式注入，前缀单引号
          if (/^[=+\-@\t\r]/.test(str)) return "'" + str;
          if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return '"' + str.replace(/"/g, '""') + '"';
          }
          return str;
        }
        const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
        let csv = BOM + '日期,用户ID,签到状态,操作人ID,更新时间\n';
        records.forEach(r => {
          const statusLabel = statusLabelMap[r.status] || r.status;
          const updatedAt = r.updated_at ? new Date(r.updated_at).toISOString() : '';
          csv += [r.date, r.userId, statusLabel, r.adminId || '', updatedAt].map(escapeCSV).join(',') + '\n';
        });

        ws.send(JSON.stringify({ type: 'csvData', csv, count: records.length }));
      } catch (error) {
        console.error('CSV export error:', error);
        ws.send(JSON.stringify({ type: 'error', message: '导出 CSV 失败: ' + error.message }));
      }
    }

    // ===== 个人月度出勤统计 =====
    if (data.type === 'getPersonalStats') {
      const uid = Number(data.userId);
      if (!Number.isFinite(uid) || uid <= 0) {
        ws.send(JSON.stringify({ type: 'error', message: '无效的用户ID' }));
        return;
      }
      // 认证检查：管理员可查所有人，非管理员只能查自己
      if (!ws.isAuthenticated && ws.userId !== uid) {
        ws.send(JSON.stringify({ type: 'error', message: '无权查询他人出勤数据' }));
        return;
      }
      try {
        const now = new Date();
        const year = data.year ? Number(data.year) : now.getFullYear();
        const month = data.month ? Number(data.month) : now.getMonth() + 1;
        if (!Number.isFinite(year) || year < 2000 || year > 2100 || !Number.isFinite(month) || month < 1 || month > 12) {
          ws.send(JSON.stringify({ type: 'error', message: '无效的年月参数' }));
          return;
        }
        const monthStr = String(month).padStart(2, '0');
        const startDate = `${year}-${monthStr}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

        const [records] = await db.query(
          `SELECT f_n2a666hq2br AS date, f_0kiw0ulq188 AS status, updated_at
           FROM attendance_records
           WHERE f_29yzstin559 = ? AND f_n2a666hq2br BETWEEN ? AND ?
           ORDER BY f_n2a666hq2br ASC`,
          [uid, startDate, endDate]
        );

        // 统计各状态天数
        const statusCounts = { present: 0, absent: 0, late: 0, leave: 0 };
        records.forEach(r => {
          if (statusCounts.hasOwnProperty(r.status)) {
            statusCounts[r.status]++;
          }
        });
        const totalDays = lastDay;
        const signedDays = records.length;
        const attendanceRate = totalDays > 0 ? Math.round((statusCounts.present / totalDays) * 100) : 0;

        ws.send(JSON.stringify({
          type: 'personalStats',
          data: {
            userId: uid,
            year,
            month,
            totalDays,
            signedDays,
            attendanceRate,
            statusCounts,
            records
          }
        }));
      } catch (error) {
        console.error('Personal stats error:', error);
        ws.send(JSON.stringify({ type: 'error', message: '获取个人统计失败: ' + error.message }));
      }
    }
  });
});

// ===== 定期清理防重复提交记录 =====
setInterval(() => {
  const now = Date.now();
  for (const [uid, ts] of lastSubmitMap) {
    if (now - ts > DEDUP_WINDOW * 2) {
      lastSubmitMap.delete(uid);
    }
  }
  // 超出大小限制时，清理最旧的条目
  if (lastSubmitMap.size > MAX_DEDUP_ENTRIES) {
    const entries = [...lastSubmitMap.entries()].sort((a, b) => a[1] - b[1]);
    const toRemove = entries.slice(0, entries.length - MAX_DEDUP_ENTRIES);
    toRemove.forEach(([uid]) => lastSubmitMap.delete(uid));
  }
}, 60000);

// ===== 优雅关闭处理 =====
function gracefulShutdown(signal) {
  console.log(`\n收到 ${signal}，正在优雅关闭...`);

  // 停止心跳检测
  clearInterval(heartbeatTimer);

  // 关闭所有 WebSocket 客户端连接
  wss.clients.forEach(client => {
    client.close(1001, '服务器正在关闭');
  });

  wss.close(() => {
    console.log('WebSocket 服务器已关闭');
  });

  server.close(() => {
    console.log('HTTP 服务器已关闭');
    db.end().then(() => {
      console.log('数据库连接池已关闭');
      process.exit(0);
    }).catch(err => {
      console.error('关闭数据库连接池失败:', err);
      process.exit(1);
    });
  });

  // 强制退出兜底：10秒后强制退出
  setTimeout(() => {
    console.error('优雅关闭超时，强制退出');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));