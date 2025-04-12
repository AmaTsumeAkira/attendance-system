const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// 提供 public 目录下的静态文件
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket 代理，将 /ws 请求转发到 ws://localhost:3000
app.use(
  '/ws',
  createProxyMiddleware({
    target: 'ws://localhost:3000',
    ws: true,
    changeOrigin: true,
    pathRewrite: { '^/ws': '' }
  })
);

// 读取 SSL 证书和私钥
const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

// 创建 HTTPS 服务器
https.createServer(options, app).listen(5000, '0.0.0.0', () => {
  console.log('Frontend HTTPS server running on https://0.0.0.0:5000');
});