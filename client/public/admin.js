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
const ws = new WebSocket(`wss://${wsHost}/ws`);

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let scanning = false;
let paused = false;
let stream = null;
let cameras = [];
let selectedCameraId = null;
let lastScannedUserId = null;
let lastScanTime = 0;
const REPEAT_SCAN_COOLDOWN = 10000; // 10秒冷却
const QR_CODE_VALIDITY_PERIOD = 15000; // 15秒有效期

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

  const constraints = {
    video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    video.style.opacity = '1';
    selectedCameraId = deviceId || cameras.find(cam => cam.label.includes('back'))?.deviceId || cameras[0]?.deviceId;
  } catch (error) {
    console.error('启动摄像头失败:', error);
    resultDiv.textContent = '无法启动摄像头';
    scanning = false;
    scanBtn.textContent = '开始扫码';
  }
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

        if (lastScannedUserId === userId && (now - lastScanTime) < REPEAT_SCAN_COOLDOWN) {
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
        ws.send(JSON.stringify({
          type: 'submitAttendance',
          userId,
          adminId: Number(adminId),
          status: statusSelect.value,
          studentInfo: { userId, name },
          timestamp
        }));
        resultDiv.textContent = `签到成功: ${name} - ${statusText} (${new Date().toLocaleTimeString()})`;
        resultDiv.classList.add('success');
        playBeep(statusSelect.value);
        lastScannedUserId = userId;
        lastScanTime = now;
      } catch (e) {
        resultDiv.textContent = '二维码解析失败，请重试';
        resultDiv.classList.add('error');
        console.error('二维码解析错误:', e);
      }
    }
  }
  requestAnimationFrame(scan);
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'error') {
    resultDiv.classList.remove('success', 'error');
    resultDiv.textContent = `错误: ${data.message}`;
    resultDiv.classList.add('error');
  } else if (data.type === 'duplicateAttendance') {
    showToast(`用户 ${data.studentInfo.name} 今日已签到`, 'error');
  }
};

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