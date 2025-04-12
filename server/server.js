const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const db = require('./config/db');

const app = express();
const server = app.listen(3000, '0.0.0.0', () => console.log('Server running on port 3000'));
const wss = new WebSocket.Server({ server });

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
  }).replace(/\//g, '-').replace(/(\d{4})-(\d{2})-(\d{2})/, '$1-$2-$3');
}

function getLocalDate() {
  return formatLocalDateTime().split(' ')[0];
}

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const data = JSON.parse(message);

    if (data.type === 'checkAttendance') {
      ws.userId = Number(data.userId);
      const [rows] = await db.query(
        'SELECT * FROM attendance_records WHERE f_n2a666hq2br = ? AND f_29yzstin559 = ?',
        [getLocalDate(), Number(data.userId)]
      );
      ws.send(JSON.stringify({ type: 'attendanceStatus', data: rows[0] || null }));
    }

    if (data.type === 'submitAttendance') {
      const { userId, adminId, status, studentInfo, timestamp } = data;
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
          [Number(userId)]
        );

        let attendanceData;
        if (existing.length > 0) {
          await db.query(
            'UPDATE user_status SET f_k1x5891pt2x = ?, updated_at = ? WHERE id = ?',
            [status, currentTimeFormatted, Number(userId)]
          );
          attendanceData = {
            id: Number(userId),
            f_k1x5891pt2x: status,
            updated_at: currentTimeFormatted
          };
          if (existing[0].f_k1x5891pt2x === status) {
            ws.send(JSON.stringify({ type: 'duplicateAttendance', userId: Number(userId), studentInfo }));
          }
        } else {
          ws.send(JSON.stringify({ type: 'error', message: `用户 ${userId} 在 user_status 中无记录，无法签到` }));
          return;
        }

        const [existingAttendance] = await db.query(
          'SELECT id, f_0kiw0ulq188 FROM attendance_records WHERE f_n2a666hq2br = ? AND f_29yzstin559 = ? LIMIT 1',
          [today, Number(userId)]
        );

        let isUpdate = false;
        if (existingAttendance.length > 0) {
          if (existingAttendance[0].f_0kiw0ulq188 !== status) {
            await db.query(
              'UPDATE attendance_records SET f_0kiw0ulq188 = ?, created_by_id = ?, updated_at = ? WHERE id = ?',
              [status, Number(adminId), currentTimeFormatted, existingAttendance[0].id]
            );
            isUpdate = true;
          }
          ws.send(JSON.stringify({ type: 'duplicateAttendance', userId: Number(userId), studentInfo }));
        } else {
          await db.query(
            'INSERT INTO attendance_records (f_n2a666hq2br, f_29yzstin559, f_0kiw0ulq188, created_by_id, updated_at) VALUES (?, ?, ?, ?, ?)',
            [today, Number(userId), status, Number(adminId), currentTimeFormatted]
          );
          isUpdate = true;
        }

        if (isUpdate) {
          const attendanceDataBoghew = {
            f_29yzstin559: Number(userId),
            f_0kiw0ulq188: status,
            updated_at: currentTimeFormatted
          };
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && client.userId === Number(userId)) {
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
      const { userId } = data;
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.userId === Number(userId)) {
          client.send(JSON.stringify({ type: 'clearQRCode', userId: Number(userId) }));
        }
      });
    }
  });
});