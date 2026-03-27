function updateTime() {
  const now = new Date();
  const timeString = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  document.getElementById('currentTime').textContent = `当前时间: ${timeString}`;
}
updateTime();
setInterval(updateTime, 1000);

const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('userid');
const name = urlParams.get('name');
const no = urlParams.get('no');

const userInfoDiv = document.getElementById('userInfo');
const nameSpan = document.createElement('div');
const noSpan = document.createElement('div');
const nameLabel = document.createElement('span');
const noLabel = document.createElement('span');
nameLabel.textContent = '姓名:';
noLabel.textContent = '学号:';
nameSpan.appendChild(nameLabel);
nameSpan.appendChild(document.createTextNode(' ' + name));
noSpan.appendChild(noLabel);
noSpan.appendChild(document.createTextNode(' ' + no));
userInfoDiv.appendChild(nameSpan);
userInfoDiv.appendChild(noSpan);

const wsHost = window.location.host;
let ws;
let qrCountdownInterval;
const REFRESH_INTERVAL = 10; // Refresh every 10 seconds
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 最大重连间隔30秒

function generateQRCodeData() {
  const timestamp = Date.now();
  return JSON.stringify({ userId: Number(userId), name, timestamp });
}

function updateQRCode() {
  const qrcodeDiv = document.getElementById('qrcode');
  const qrcodeContainer = document.getElementById('qrcode-container');
  qrcodeDiv.innerHTML = ''; // Clear previous QR code

  // Get the container's computed width (excluding padding)
  const containerWidth = qrcodeContainer.clientWidth - 20; // Subtract 10px padding on each side
  new QRCode(qrcodeDiv, {
    text: encodeURIComponent(generateQRCodeData()),
    width: containerWidth, // Dynamically set to container width
    height: containerWidth, // Maintain square aspect ratio
    colorDark: '#000000',
    colorLight: '#ffffff'
  });
}

function startCountdown() {
  let timeLeft = REFRESH_INTERVAL;
  const countdownDiv = document.getElementById('qrCountdown');
  countdownDiv.textContent = `刷新倒计时: ${timeLeft}s`;

  const countdownInterval = setInterval(() => {
    timeLeft--;
    countdownDiv.textContent = `刷新倒计时: ${timeLeft}s`;
    if (timeLeft <= 0) {
      timeLeft = REFRESH_INTERVAL;
      if (document.getElementById('status').textContent === '请出示二维码以考勤') {
        updateQRCode(); // Refresh QR code when countdown reaches 0
      }
    }
  }, 1000);

  return countdownInterval;
}

function connectWebSocket() {
  if (ws) {
    ws.onclose = null; // 防止重连时触发多次 onclose
    ws.close();
  }
  clearInterval(qrCountdownInterval); // 防止重连时创建多个interval
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${wsHost}/ws`);

  ws.onopen = () => {
    reconnectAttempts = 0; // 重置重连次数
    document.getElementById('status').textContent = '正在连接服务器...';
    ws.send(JSON.stringify({ type: 'checkAttendance', userId: Number(userId) }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const statusDiv = document.getElementById('status');
    const qrcodeContainer = document.getElementById('qrcode-container');
    const statusText = document.getElementById('status-text');

    if (data.type === 'personalStats') {
      renderPersonalStats(data.data);
      return;
    }

    if (data.type === 'attendanceStatus') {
      if (!data.data) {
        statusDiv.textContent = '正在生成二维码...';
        updateQRCode();
        statusDiv.textContent = '请出示二维码以考勤';
        statusText.textContent = '';
        qrcodeContainer.classList.remove('attended', 'absent', 'late', 'leave');
        statusDiv.classList.remove('attended', 'absent', 'late', 'leave');
        qrCountdownInterval = startCountdown(); // Start countdown
      } else {
        updateStatus(data.data);
        clearInterval(qrCountdownInterval); // Stop countdown if checked in
        document.getElementById('qrCountdown').textContent = '';
      }
    } else if (data.type === 'attendanceUpdated' && data.data.f_29yzstin559 === Number(userId)) {
      qrcodeContainer.innerHTML = '<div id="qrcode"></div><span id="status-text"></span><div id="qrCountdown"></div>';
      updateStatus(data.data);
      clearInterval(qrCountdownInterval); // Stop countdown on update
      document.getElementById('qrCountdown').textContent = '';
    } else if (data.type === 'clearQRCode' && data.userId === Number(userId)) {
      qrcodeContainer.innerHTML = '<div id="qrcode"></div><span id="status-text"></span><div id="qrCountdown"></div>';
      statusDiv.textContent = '二维码已清除，请重新签到';
      statusText.textContent = '';
      qrcodeContainer.classList.remove('attended', 'absent', 'late', 'leave');
      statusDiv.classList.remove('attended', 'absent', 'late', 'leave');
      updateQRCode();
      qrCountdownInterval = startCountdown(); // Restart countdown
    } else if (data.type === 'error') {
      statusDiv.textContent = `错误: ${data.message}`;
      qrcodeContainer.innerHTML = '<div id="qrcode"></div><span id="status-text">错误</span><div id="qrCountdown"></div>';
      qrcodeContainer.classList.add('absent');
      statusDiv.classList.add('absent');
      clearInterval(qrCountdownInterval);
      document.getElementById('qrCountdown').textContent = '';
    }
  };

  ws.onerror = () => {
    document.getElementById('status').textContent = '连接错误，请刷新页面重试';
    document.getElementById('qrcode-container').classList.add('absent');
    clearInterval(qrCountdownInterval);
  };

  ws.onclose = () => {
    document.getElementById('status').textContent = '连接已断开，正在尝试重连...';
    clearInterval(qrCountdownInterval);
    reconnectAttempts++;
    const delay = Math.min(2000 * Math.pow(1.5, reconnectAttempts - 1), MAX_RECONNECT_DELAY);
    setTimeout(connectWebSocket, delay);
  };
}

connectWebSocket();

// ===== 个人出勤统计 =====
let statsYear = new Date().getFullYear();
let statsMonth = new Date().getMonth() + 1;
const statsToggle = document.getElementById('statsToggle');
const personalStatsPanel = document.getElementById('personalStats');
const statusLabelMap = { present: '出勤', absent: '缺勤', late: '迟到', leave: '请假' };
const statusColorMap = { present: '#27ae60', absent: '#c0392b', late: '#e67e22', leave: '#2980b9' };
const statusEmojiMap = { present: '✅', absent: '❌', late: '⏰', leave: '📝' };

statsToggle.onclick = () => {
  if (personalStatsPanel.style.display === 'none') {
    personalStatsPanel.style.display = 'block';
    statsToggle.textContent = '📊 隐藏统计';
    requestPersonalStats();
  } else {
    personalStatsPanel.style.display = 'none';
    statsToggle.textContent = '📊 查看出勤统计';
  }
};

document.getElementById('prevMonth').onclick = () => {
  statsMonth--;
  if (statsMonth < 1) { statsMonth = 12; statsYear--; }
  requestPersonalStats();
};

document.getElementById('nextMonth').onclick = () => {
  statsMonth++;
  if (statsMonth > 12) { statsMonth = 1; statsYear++; }
  requestPersonalStats();
};

function requestPersonalStats() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'getPersonalStats', userId: Number(userId), year: statsYear, month: statsMonth }));
  }
}

function renderPersonalStats(data) {
  document.getElementById('statsMonthLabel').textContent = `${data.year}年${data.month}月`;

  // Summary badges
  const summaryDiv = document.getElementById('statsSummary');
  let html = `<span style="background:#ecf0f1;padding:5px 10px;border-radius:6px;font-size:13px;">签到: <b>${data.signedDays}</b>/${data.totalDays}天</span>`;
  for (const [status, label] of Object.entries(statusLabelMap)) {
    const count = data.statusCounts[status] || 0;
    const color = statusColorMap[status];
    html += `<span style="background:${color}15;color:${color};padding:5px 10px;border-radius:6px;font-size:13px;border:1px solid ${color}30;">${statusEmojiMap[status]} ${label}: <b>${count}</b></span>`;
  }
  summaryDiv.innerHTML = html;

  // Rate bar
  const rateDiv = document.getElementById('attendanceRateBar');
  const rate = data.attendanceRate;
  const barColor = rate >= 90 ? '#27ae60' : rate >= 60 ? '#f39c12' : '#e74c3c';
  rateDiv.innerHTML = `
    <div style="display:flex; justify-content:space-between; font-size:12px; color:#555; margin-bottom:4px;">
      <span>📋 本月出勤率</span>
      <span style="font-weight:600; color:${barColor};">${rate}%</span>
    </div>
    <div style="background:#ecf0f1; border-radius:10px; height:20px; overflow:hidden; position:relative;">
      <div style="background:linear-gradient(90deg, ${barColor}, ${barColor}cc); width:${rate}%; height:100%; border-radius:10px; transition:width 0.5s ease;"></div>
    </div>
  `;

  // Calendar grid
  const calendarDiv = document.getElementById('monthlyCalendar');
  const recordMap = {};
  data.records.forEach(r => {
    const day = r.date.split('-')[2].replace(/^0/, '');
    recordMap[day] = r.status;
  });

  const firstDay = new Date(data.year, data.month - 1, 1).getDay(); // 0=Sun
  let calHTML = '<div style="display:grid; grid-template-columns:repeat(7,1fr); gap:2px; text-align:center;">';
  ['日','一','二','三','四','五','六'].forEach(d => {
    calHTML += `<div style="font-size:11px; color:#999; padding:3px 0;">${d}</div>`;
  });
  for (let i = 0; i < firstDay; i++) calHTML += '<div></div>';
  for (let d = 1; d <= data.totalDays; d++) {
    const status = recordMap[String(d)];
    let bg = '#f5f5f5', fg = '#333';
    if (status) {
      bg = statusColorMap[status] + '25';
      fg = statusColorMap[status];
    }
    calHTML += `<div style="background:${bg}; color:${fg}; border-radius:4px; padding:4px 0; font-size:12px; font-weight:${status ? '600' : '400'};" title="${status ? statusLabelMap[status] : ''}">${d}</div>`;
  }
  calHTML += '</div>';
  calendarDiv.innerHTML = calHTML;
}

function flashBackground(color) {
  document.body.style.backgroundColor = color;
  setTimeout(() => {
    document.body.style.backgroundColor = '#f5f5f5';
    setTimeout(() => {
      document.body.style.backgroundColor = color;
      setTimeout(() => {
        document.body.style.backgroundColor = '#f5f5f5';
      }, 200);
    }, 200);
  }, 200);
}

function updateStatus(attendanceData) {
  const statusDiv = document.getElementById('status');
  const qrcodeContainer = document.getElementById('qrcode-container');
  const statusText = document.getElementById('status-text');
  const statusMap = {
    'present': '出勤',
    'absent': '缺勤',
    'late': '迟到',
    'leave': '请假'
  };
  const status = statusMap[attendanceData.f_0kiw0ulq188];
  const updatedAt = attendanceData.updated_at 
    ? new Date(attendanceData.updated_at).toLocaleString('zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false 
      }).replace(/\//g, '-')
    : '未知时间';

  statusText.textContent = status;
  qrcodeContainer.classList.remove('attended', 'absent', 'late', 'leave');
  statusDiv.classList.remove('attended', 'absent', 'late', 'leave');
  
  let flashColor;
  switch(status) {
    case '出勤':
      qrcodeContainer.classList.add('attended');
      statusDiv.classList.add('attended');
      flashColor = '#27ae60';
      break;
    case '缺勤':
      qrcodeContainer.classList.add('absent');
      statusDiv.classList.add('absent');
      flashColor = '#c0392b';
      break;
    case '迟到':
      qrcodeContainer.classList.add('late');
      statusDiv.classList.add('late');
      flashColor = '#e67e22';
      break;
    case '请假':
      qrcodeContainer.classList.add('leave');
      statusDiv.classList.add('leave');
      flashColor = '#2980b9';
      break;
  }

  // 使用 textContent 防止 XSS，安全地显示签到信息
  statusDiv.textContent = '';
  const statusLine = document.createElement('div');
  statusLine.textContent = `签到状态: ${status}`;
  const timeLine = document.createElement('div');
  timeLine.textContent = `更新时间: ${updatedAt}`;
  statusDiv.appendChild(statusLine);
  statusDiv.appendChild(timeLine);
  flashBackground(flashColor);
}