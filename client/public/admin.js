const urlParams = new URLSearchParams(window.location.search);
const adminId = urlParams.get('userid');
const adminName = urlParams.get('name');

const video = document.getElementById('video');
const scanBtn = document.getElementById('scanBtn');
const resultDiv = document.getElementById('result');
const statusSelect = document.getElementById('statusSelect');
const cameraSelect = document.getElementById('cameraSelect');
const toast = document.getElementById('toast');

const wsHost = window.location.host;
let ws;

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let scanning = false;
let paused = false;
let stream = null;
let cameras = [];
let selectedCameraId = null;
const scanCooldownMap = new Map(); // Map<userId, timestamp> 防止重复扫描
const REPEAT_SCAN_COOLDOWN = 10000; // 10秒冷却
const QR_CODE_VALIDITY_PERIOD = 15000; // 15秒有效期
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 最大重连间隔30秒

// 定期清理过期的冷却记录，防止内存泄漏
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamp] of scanCooldownMap) {
    if (now - timestamp >= REPEAT_SCAN_COOLDOWN) {
      scanCooldownMap.delete(userId);
    }
  }
}, 60000);

async function populateCameraOptions() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    cameras = devices.filter(device => device.kind === 'videoinput');
    cameraSelect.innerHTML = '<option value="">选择摄像头</option>';
    cameras.forEach((camera, index) => {
      const option = document.createElement('option');
      option.value = camera.deviceId;
      option.text = camera.label || `摄像头 ${index + 1}`;
      cameraSelect.appendChild(option);
    });
    if (cameras.length > 0) {
      selectedCameraId = cameras.find(cam => cam.label.includes('back'))?.deviceId || cameras[0].deviceId;
      cameraSelect.value = selectedCameraId;
      if (scanning) startVideo(selectedCameraId);
    }
  } catch (error) {
    console.error('获取摄像头失败:', error);
    resultDiv.textContent = '无法获取摄像头列表';
  }
}

async function startVideo(deviceId) {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }

  let constraints;
  if (deviceId) {
    try {
      constraints = { video: { deviceId: { exact: deviceId } } };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      // Fallback: try without exact constraint if selected camera is unavailable
      console.warn('Selected camera unavailable, falling back:', e);
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      } catch (e2) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
    }
  } else {
    try {
      constraints = { video: { facingMode: 'environment' } };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    }
  }
  video.srcObject = stream;
  video.style.opacity = '1';
  selectedCameraId = deviceId || cameras.find(cam => cam.label.includes('back'))?.deviceId || cameras[0]?.deviceId;
}

populateCameraOptions();

cameraSelect.onchange = () => {
  if (scanning) {
    video.style.opacity = '0';
    selectedCameraId = cameraSelect.value;
    startVideo(selectedCameraId).then(() => {
      video.style.opacity = '1';
    });
  }
};

scanBtn.onclick = async () => {
  const videoWrapper = document.querySelector('.video-wrapper');
  if (!scanning) {
    scanning = true;
    paused = false;
    scanBtn.textContent = '暂停扫码';
    resultDiv.textContent = '正在扫描...';
    videoWrapper.classList.add('scanning');
    await startVideo(selectedCameraId);
    requestAnimationFrame(scan);
  } else if (!paused) {
    paused = true;
    scanBtn.textContent = '恢复扫码';
    resultDiv.textContent = '扫描已暂停';
    videoWrapper.classList.remove('scanning');
  } else {
    paused = false;
    scanBtn.textContent = '暂停扫码';
    resultDiv.textContent = '正在扫描...';
    videoWrapper.classList.add('scanning');
    requestAnimationFrame(scan);
  }
};

function stopScanning() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    scanning = false;
    paused = false;
    scanBtn.textContent = '开始扫码';
    resultDiv.textContent = '扫码已停止';
    document.querySelector('.video-wrapper').classList.remove('scanning');
  }
}

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

const scan = () => {
  if (!scanning || paused) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.height = video.videoHeight;
    canvas.width = video.videoWidth;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert'
    });

    if (code) {
      resultDiv.classList.remove('success', 'error');
      try {
        const qrData = JSON.parse(decodeURIComponent(code.data));
        const userId = Number(qrData.userId);
        const name = qrData.name;
        const timestamp = Number(qrData.timestamp);
        const now = Date.now();

        const timeDifference = now - timestamp;
        if (timeDifference > QR_CODE_VALIDITY_PERIOD) {
          showToast(`二维码已过期（有效期 ${QR_CODE_VALIDITY_PERIOD / 1000} 秒），请刷新二维码`, 'error');
          requestAnimationFrame(scan);
          return;
        }

        const lastScanTime = scanCooldownMap.get(userId);
        if (lastScanTime && (now - lastScanTime) < REPEAT_SCAN_COOLDOWN) {
          const remaining = Math.ceil((REPEAT_SCAN_COOLDOWN - (now - lastScanTime)) / 1000);
          showToast(`用户 ${name} 已在短时间内签到，请等待 ${remaining} 秒`, 'error');
          requestAnimationFrame(scan);
          return;
        }

        const statusMap = {
          'present': '出勤',
          'absent': '缺勤',
          'late': '迟到',
          'leave': '请假'
        };
        const statusText = statusMap[statusSelect.value];
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'submitAttendance',
            userId,
            adminId: Number(adminId),
            status: statusSelect.value,
            studentInfo: { userId, name },
            timestamp
          }));
        }
        resultDiv.textContent = `签到提交: ${name} - ${statusText} (${new Date().toLocaleTimeString()})`;
        resultDiv.classList.add('success');
        playBeep(statusSelect.value);
        scanCooldownMap.set(userId, now);
      } catch (e) {
        resultDiv.textContent = '二维码解析失败，请重试';
        resultDiv.classList.add('error');
        console.error('二维码解析错误:', e);
      }
    }
  }
  requestAnimationFrame(scan);
};

function connectWebSocket() {
  if (ws) {
    ws.onclose = null;
    ws.close();
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${wsHost}/ws`);

  ws.onopen = () => {
    reconnectAttempts = 0;
    resultDiv.textContent = 'WebSocket 已连接';
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'attendanceStats') {
      renderStats(data.data);
      return;
    }

    if (data.type === 'attendanceByDate') {
      renderDateRecords(data.data);
      return;
    }

    if (data.type === 'csvData') {
      downloadCSV(data.csv, data.count);
      return;
    }

    if (data.type === 'error') {
      resultDiv.classList.remove('success', 'error');
      resultDiv.textContent = `错误: ${data.message}`;
      resultDiv.classList.add('error');
    } else if (data.type === 'duplicateAttendance') {
      showToast(data.message || `用户 ${data.studentInfo?.name || data.userId} 今日已签到`, 'error');
    } else if (data.type === 'attendanceUpdated') {
      showToast(`签到成功: ${data.studentInfo?.name || data.userId}`, 'success');
    }
  };

  ws.onerror = () => {
    resultDiv.textContent = '连接错误，正在尝试重连...';
  };

  ws.onclose = () => {
    resultDiv.textContent = '连接已断开，正在尝试重连...';
    reconnectAttempts++;
    const delay = Math.min(2000 * Math.pow(1.5, reconnectAttempts - 1), MAX_RECONNECT_DELAY);
    setTimeout(connectWebSocket, delay);
  };
}

connectWebSocket();

function showToast(message, type = 'default') {
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function playBeep(status) {
  try {
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    const freqMap = {
      'present': 1000, // 出勤
      'absent': 500,  // 缺勤
      'late': 800,  // 迟到
      'leave': 1200  // 请假
    };
    const freq = freqMap[status] || 1000;
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
    oscillator.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (error) {
    console.error('播放提示音失败:', error);
  }
}

window.onunload = () => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
};

// ===== 签到统计功能 =====
const statsBtn = document.getElementById('statsBtn');
const statsPanel = document.getElementById('statsPanel');

statsBtn.onclick = () => {
  if (statsPanel.style.display === 'none') {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'getAttendanceStats' }));
    }
    statsPanel.style.display = 'block';
    statsBtn.textContent = '📊 隐藏统计';
  } else {
    statsPanel.style.display = 'none';
    statsBtn.textContent = '📊 查看统计';
  }
};

const statusLabelMap = { present: '出勤', absent: '缺勤', late: '迟到', leave: '请假' };
const statusColorMap = { present: '#27ae60', absent: '#c0392b', late: '#e67e22', leave: '#2980b9' };

function renderStats(data) {
  const summaryDiv = document.getElementById('todaySummary');
  const listEl = document.getElementById('leaderboardList');
  const rateBarDiv = document.getElementById('attendanceRateBar');

  // Today summary badges
  const countMap = {};
  data.stats.forEach(s => { countMap[s.status] = s.count; });
  const signedCount = data.stats.reduce((sum, s) => sum + s.count, 0);
  const rate = data.totalUsers > 0 ? Math.round((signedCount / data.totalUsers) * 100) : 0;

  let summaryHTML = `<span style="background:#ecf0f1;padding:6px 12px;border-radius:6px;font-size:14px;">总人数: <b>${data.totalUsers}</b></span>`;
  const unchecked = data.uncheckedCount !== undefined ? data.uncheckedCount : (data.totalUsers - signedCount);
  if (unchecked > 0) {
    summaryHTML += `<span style="background:#e74c3c15;color:#e74c3c;padding:6px 12px;border-radius:6px;font-size:14px;border:1px solid #e74c3c40;">⏳ 未签到: <b>${unchecked}</b></span>`;
  }
  for (const [status, label] of Object.entries(statusLabelMap)) {
    const count = countMap[status] || 0;
    const color = statusColorMap[status];
    summaryHTML += `<span style="background:${color}20;color:${color};padding:6px 12px;border-radius:6px;font-size:14px;border:1px solid ${color}40;">${label}: <b>${count}</b></span>`;
  }
  summaryDiv.innerHTML = summaryHTML;

  // 签到率进度条
  if (rateBarDiv) {
    const barColor = rate >= 90 ? '#27ae60' : rate >= 60 ? '#f39c12' : '#e74c3c';
    rateBarDiv.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-size:13px; color:#555; margin-bottom:6px;">
        <span>📋 签到进度</span>
        <span><b style="color:${barColor};">${signedCount}</b>/${data.totalUsers} (${rate}%)</span>
      </div>
      <div style="background:#ecf0f1; border-radius:10px; height:22px; overflow:hidden; position:relative;">
        <div style="background:linear-gradient(90deg, ${barColor}, ${barColor}dd); width:${rate}%; height:100%; border-radius:10px; transition:width 0.6s ease;"></div>
        <span style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:12px; font-weight:600; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.3);">${rate}%</span>
      </div>
    `;
  }

  // Leaderboard - 使用 DOM API 防止 XSS
  if (data.leaderboard.length === 0) {
    listEl.innerHTML = '<li style="color:#999;">暂无数据</li>';
  } else {
    listEl.innerHTML = '';
    data.leaderboard.forEach((item, i) => {
      const li = document.createElement('li');
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
      const days = document.createElement('b');
      days.textContent = item.presentDays;
      li.textContent = `${medal} 用户 ${item.userId} — `;
      li.appendChild(days);
      li.appendChild(document.createTextNode(' 天出勤'));
      listEl.appendChild(li);
    });
  }
}

// ===== 按日期查询签到记录 =====
const queryDateBtn = document.getElementById('queryDateBtn');
const queryDateInput = document.getElementById('queryDate');

const todayStr = new Date().toISOString().split('T')[0];
queryDateInput.value = todayStr;

queryDateBtn.onclick = () => {
  const date = queryDateInput.value;
  if (!date) {
    showToast('请选择日期', 'error');
    return;
  }
  if (ws.readyState !== WebSocket.OPEN) {
    showToast('WebSocket 未连接，请稍后重试', 'error');
    return;
  }
  queryDateBtn.textContent = '⏳ 查询中...';
  queryDateBtn.disabled = true;
  ws.send(JSON.stringify({ type: 'getAttendanceByDate', date }));
};

function renderDateRecords(data) {
  queryDateBtn.textContent = '查询';
  queryDateBtn.disabled = false;
  const panel = document.getElementById('dateResultPanel');
  const summaryDiv = document.getElementById('dateSummary');
  const listEl = document.getElementById('dateRecordList');
  panel.style.display = 'block';

  // 统计摘要
  const countMap = {};
  data.stats.forEach(s => { countMap[s.status] = s.count; });
  let summaryHTML = `<span style="background:#ecf0f1;padding:4px 10px;border-radius:6px;font-size:13px;">签到: <b>${data.records.length}</b>/${data.totalUsers}</span>`;
  const dateUnchecked = data.totalUsers - data.records.length;
  if (dateUnchecked > 0) {
    summaryHTML += `<span style="background:#e74c3c15;color:#e74c3c;padding:4px 10px;border-radius:6px;font-size:13px;border:1px solid #e74c3c40;">⏳ 未签到: <b>${dateUnchecked}</b></span>`;
  }
  for (const [status, label] of Object.entries(statusLabelMap)) {
    const count = countMap[status] || 0;
    if (count > 0) {
      const color = statusColorMap[status];
      summaryHTML += `<span style="background:${color}20;color:${color};padding:4px 10px;border-radius:6px;font-size:13px;border:1px solid ${color}40;">${label}: <b>${count}</b></span>`;
    }
  }
  summaryDiv.innerHTML = summaryHTML;

  // 记录列表
  if (data.records.length === 0) {
    listEl.innerHTML = '<li style="color:#999;">该日期无签到记录</li>';
  } else {
    listEl.innerHTML = '';
    data.records.forEach(r => {
      const li = document.createElement('li');
      const label = statusLabelMap[r.status] || r.status;
      const time = r.updated_at || '';
      li.textContent = `用户 ${r.userId} — ${label} (${time})`;
      listEl.appendChild(li);
    });
  }
}

// ===== CSV 导出功能 =====
const exportBtn = document.getElementById('exportBtn');
const exportStartDate = document.getElementById('exportStartDate');
const exportEndDate = document.getElementById('exportEndDate');

// 设置默认日期为今天
exportStartDate.value = todayStr;
exportEndDate.value = todayStr;

exportBtn.onclick = () => {
  if (ws.readyState !== WebSocket.OPEN) {
    showToast('WebSocket 未连接，请稍后重试', 'error');
    return;
  }
  const startDate = exportStartDate.value;
  const endDate = exportEndDate.value;
  if (!startDate || !endDate) {
    showToast('请选择起止日期', 'error');
    return;
  }
  if (startDate > endDate) {
    showToast('起始日期不能晚于结束日期', 'error');
    return;
  }
  exportBtn.textContent = '⏳ 导出中...';
  exportBtn.disabled = true;
  ws.send(JSON.stringify({ type: 'exportCSV', startDate, endDate }));
};

function downloadCSV(csvContent, count) {
  exportBtn.textContent = '📥 导出签到记录 CSV';
  exportBtn.disabled = false;
  if (count === 0) {
    showToast('所选日期范围内无签到记录', 'error');
    return;
  }
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `签到记录_${exportStartDate.value}_${exportEndDate.value}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`已导出 ${count} 条签到记录`, 'success');
}