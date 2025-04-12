# 考勤系统 - 独立WebSocket实时签到解决方案

## 项目概述

这是一个独立的实时考勤系统，基于WebSocket技术实现。系统包含学生端、管理员端和调试工具，通过二维码扫描完成签到。虽然最初设计为与NocoBase配合使用，但完全独立运行，可以单独部署使用。

## 功能特点

- **独立运行**：不依赖任何特定平台，可单独部署使用
- **实时通信**：基于WebSocket的实时双向通信
- **二维码签到**：动态生成二维码，15秒自动刷新
- **多种考勤状态**：支持出勤、缺勤、迟到、请假四种状态
- **防重复签到**：内置防重复机制
- **调试工具**：提供完整调试界面
- **灵活配置**：可自定义数据库结构和字段

## 技术栈

- **前端**：HTML5, CSS3, JavaScript
- **后端**：Node.js, Express
- **数据库**：MySQL（可替换）
- **实时通信**：WebSocket
- **二维码**：QRCode.js + jsQR

## 项目结构

```
attendance-system/
├── client/                  # 客户端代码
│   ├── public/              # 静态文件
│   │   ├── admin.html       # 管理员界面
│   │   ├── admin.js         # 管理员逻辑
│   │   ├── debug.html       # 调试工具
│   │   ├── index.html       # 学生端界面
│   │   ├── jsQR.js          # 二维码识别库
│   │   ├── qrcode.min.js    # 二维码生成库
│   │   └── student.js       # 学生端逻辑
│   ├── cert.pem             # HTTPS证书
│   ├── key.pem              # HTTPS密钥
│   └── server.js            # 前端服务器
├── server/                  # 服务器代码
│   ├── config/
│   │   └── db.js            # 数据库配置
│   ├── package.json         # 服务器依赖
│   └── server.js            # 主服务器
└── README.md                # 项目说明文档
```

## 快速开始

### 1. 克隆仓库
```bash
git clone https://github.com/AmaTsumeAkira/attendance-system.git
cd attendance-system
```

### 2. 安装依赖
```bash
# 后端依赖
cd server
npm install

# 前端依赖
cd ../client
npm install
```

### 3. 数据库设置

#### 创建数据库表：
```sql
CREATE TABLE `attendance_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `date` varchar(20) NOT NULL,
  `user_id` int NOT NULL,
  `status` varchar(20) NOT NULL,
  `created_by` int DEFAULT NULL,
  `updated_at` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `user_status` (
  `id` int NOT NULL,
  `status` varchar(20) DEFAULT NULL,
  `updated_at` varchar(30) DEFAULT NULL,
  PRIMARY KEY (`id`)
);
```

#### 修改数据库配置 (`server/config/db.js`):
```javascript
module.exports = {
  host: 'localhost',
  user: 'root',
  password: 'yourpassword',
  database: 'attendance_system',
  waitForConnections: true,
  connectionLimit: 10
};
```

### 4. 运行系统
```bash
# 启动后端
cd server
npm start

# 启动前端 (新终端)
cd ../client
npm start
```

## 使用说明

### 访问地址
- **学生端**: https://localhost:5000?userid=1&name=张三&no=20230001
- **管理员端**: https://localhost:5000/admin.html
- **调试工具**: https://localhost:5000/debug.html

### 基本流程
1. 学生访问学生端生成二维码
2. 管理员用管理员端扫描二维码
3. 选择考勤状态并提交
4. 学生端实时更新考勤状态

## 自定义配置

### 1. 修改数据库结构
如需修改表名或字段名，请在`server/server.js`中替换以下内容：
- `attendance_records` → 您的考勤记录表名
- `user_status` → 您的用户状态表名
- 各字段名根据实际情况修改

### 2. 状态码配置
默认状态码可在代码中修改：
```javascript
// 管理员端和调试工具中修改这些值
const statusMap = {
  'present': '出勤',
  'absent': '缺勤',
  'late': '迟到',
  'leave': '请假'
};
```

### 3. NocoBase集成说明（可选）
如需与NocoBase集成：
1. 使用NocoBase的表名和字段名
2. 确保用户ID系统一致
3. 通过NocoBase管理用户权限

## 常见问题

**Q: 如何修改端口号？**
A: 修改`server/server.js`和`client/server.js`中的端口配置

**Q: 如何延长二维码有效期？**
A: 修改代码中的`QR_CODE_VALIDITY_PERIOD`值（单位毫秒）

**Q: 支持其他数据库吗？**
A: 可以，需修改`server/config/db.js`并使用对应的Node.js驱动
