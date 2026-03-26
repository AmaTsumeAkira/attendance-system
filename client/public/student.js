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
    ws.close();
  }
  clearInterval(qrCountdownInterval); // 防止重连时创建多个interval
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${wsHost}/ws`);

  ws.onopen = () => {
    document.getElementById('status').textContent = '正在连接服务器...';
    ws.send(JSON.stringify({ type: 'checkAttendance', userId: Number(userId) }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const statusDiv = document.getElementById('status');
    const qrcodeContainer = document.getElementById('qrcode-container');
    const statusText = document.getElementById('status-text');

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
    setTimeout(connectWebSocket, 2000);
  };
}

connectWebSocket();

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