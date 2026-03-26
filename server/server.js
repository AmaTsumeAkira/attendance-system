const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const db = require('./config/db');

const app = express();
const server = app.listen(3000, '0.0.0.0', () => console.log('Server running on port 3000'));
const wss = new WebSocket.Server({ server });

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
  return formatLocalDateTime().split(' ')[0];
}

wss.on('connection', (ws) => {
  // 心跳检测
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', async (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: '无效的消息格式，无法解析 JSON' }));
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
      ws.send(JSON.stringify({ type: 'attendanceStatus', data: rows[0] || null }));
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

        let isUpdate = false;
        if (existingAttendance.length > 0) {
          if (existingAttendance[0].f_0kiw0ulq188 !== status) {
            await db.query(
              'UPDATE attendance_records SET f_0kiw0ulq188 = ?, created_by_id = ?, updated_at = ? WHERE id = ?',
              [status, numAdminId, currentTimeFormatted, existingAttendance[0].id]
            );
          }
          // 无论状态是否变化，都通知管理员已存在记录（避免误以为未成功）
          ws.send(JSON.stringify({ type: 'duplicateAttendance', userId: numUserId, studentInfo }));
          isUpdate = true; // 仍然需要通知学生当前状态
        } else {
          await db.query(
            'INSERT INTO attendance_records (f_n2a666hq2br, f_29yzstin559, f_0kiw0ulq188, created_by_id, updated_at) VALUES (?, ?, ?, ?, ?)',
            [today, numUserId, status, numAdminId, currentTimeFormatted]
          );
          isUpdate = true;
        }

        if (isUpdate) {
          const attendanceDataBoghew = {
            f_29yzstin559: numUserId,
            f_0kiw0ulq188: status,
            updated_at: currentTimeFormatted
          };
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && client.userId === numUserId) {
              client.send(JSON.stringify({ 
                type: 'attendanceUpdated', 
                data: attendanceDataBoghew,
                studentInfo 
              }));
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

        ws.send(JSON.stringify({
          type: 'attendanceStats',
          data: {
            today,
            stats: todayStats,
            totalUsers: totalUsers[0].total,
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
          // 以 =、+、-、@ 开头可能导致公式注入，前缀单引号
          if (/^[=+\-@]/.test(str)) return "'" + str;
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
  });
});