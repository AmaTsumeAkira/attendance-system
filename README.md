# 📋 考勤系统 v2.0

一个基于 React + SQLite 的完整在线考勤管理系统，支持 QR 码实时签到、多角色权限、统计报表、请假审批。

> 前身为基于 WebSocket 的独立签到工具，v2.0 全面重构为完整系统。

## ✨ 特性

- 🔐 **角色权限** — 超级管理员 / 管理员 / 教师 / 学生 四级权限体系
- 📱 **QR 码签到** — 动态 Token、15 秒自动刷新、防重复签到
- ⚡ **实时通信** — WebSocket 双向推送，签到状态秒级更新
- 📊 **统计报表** — 多维度图表（出勤率趋势、状态分布、排行榜）
- 🌙 **深色模式** — 一键切换，自动跟随系统偏好
- 📤 **CSV 导出** — 签到记录批量导出，支持日期范围筛选
- 📦 **SQLite** — 零配置数据库，单文件部署，WAL 模式高性能

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 · Vite · react-router-dom · recharts · lucide-react |
| 后端 | Node.js · Express · WebSocket (ws) |
| 数据库 | SQLite (better-sqlite3) · WAL 模式 |
| 认证 | JWT · bcryptjs |
| 工具 | date-fns · multer · uuid |

## 🚀 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/AmaTsumeAkira/attendance-system.git
cd attendance-system

# 2. 安装所有依赖
npm run install:all

# 3. 初始化数据库 + 测试数据
cd server && npm run seed && cd ..

# 4. 启动开发模式（前后端同时启动）
npm run dev
```

- 🌐 前端: http://localhost:5173
- 🔧 后端: http://localhost:3000
- 📡 WebSocket: ws://localhost:3000/ws

### 测试账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `admin123` | 超级管理员 |
| `teacher1` | `teacher123` | 教师 |
| `teacher2` | `teacher123` | 教师 |
| `student01` ~ `student10` | `student123` | 学生 |

## 📁 项目结构

```
attendance-system/
├── server/                          # 后端服务
│   └── src/
│       ├── index.js                 # 入口 (Express + WebSocket)
│       ├── db.js                    # SQLite 连接 + 13 张表自动建表
│       ├── seed.js                  # 测试数据生成
│       ├── middleware/
│       │   └── auth.js              # JWT 验证 + 角色守卫
│       ├── routes/
│       │   ├── auth.js              # 登录 / 登出 / 改密
│       │   ├── users.js             # 用户 CRUD + CSV 导入
│       │   ├── classes.js           # 班级管理 + 学生分配
│       │   ├── courses.js           # 课程管理
│       │   ├── sessions.js          # 签到会话 (QR Token)
│       │   ├── attendance.js        # 出勤记录 + 导出
│       │   ├── stats.js             # 多维度统计
│       │   ├── leaves.js            # 请假审批
│       │   ├── schedules.js         # 课表模板
│       │   └── grades.js            # 年级管理
│       ├── ws/
│       │   └── handler.js           # WebSocket 消息处理
│       └── utils/
│           └── helpers.js           # 响应格式 / CSV 工具
│
├── client/                          # 前端 (React)
│   ├── index.html
│   ├── vite.config.js               # Vite + 代理配置
│   └── src/
│       ├── main.jsx                 # 入口
│       ├── App.jsx                  # 路由定义
│       ├── index.css                # 全局样式 (CSS 变量主题)
│       ├── api/                     # Axios API 封装 (10 个模块)
│       ├── components/              # 通用组件 (11 个)
│       │   ├── Layout / Sidebar / Header
│       │   ├── DataTable / Modal / Toast
│       │   ├── QRCodeDisplay / QRScanner
│       │   └── ProtectedRoute / StatusBadge / DatePicker
│       ├── pages/                   # 页面组件 (14 个)
│       │   ├── Login / Dashboard / Profile
│       │   ├── Users / Classes / Courses
│       │   ├── Sessions / SessionActive / StudentCheckIn
│       │   ├── Attendance / Stats / Leaves
│       │   ├── MyAttendance / Schedules
│       ├── hooks/                   # useAuth / useWebSocket
│       └── context/                 # AuthContext
│
├── API_CONTRACT.md                  # API 接口规范文档
├── .env.example                     # 环境变量模板
└── package.json                     # Monorepo 根配置
```

## 🗄 数据库设计

13 张表，核心关系：

```
users ─┬── class_students ── classes ── grades
       ├── courses ─── course_classes ────┘
       │      │
       │      └── sessions ─┬── attendance_records
       │                    └── leave_requests
       ├── schedule_templates
       └── audit_logs
```

| 表名 | 说明 |
|------|------|
| `users` | 用户（角色、学号、密码哈希） |
| `grades` / `classes` / `class_students` | 年级·班级·学生分配 |
| `courses` / `course_classes` | 课程·班级关联 |
| `sessions` | 签到会话（QR Token、时间、状态） |
| `attendance_records` | 出勤记录 |
| `leave_requests` | 请假申请 + 审批 |
| `schedule_templates` | 课表模板 |
| `audit_logs` | 操作日志 |
| `system_config` | 系统配置 |

## 🔌 API 概览

REST 接口前缀: `/api/v1`

| 模块 | 端点 | 说明 |
|------|------|------|
| 认证 | `POST /auth/login` | JWT 登录 |
| 用户 | `GET/POST /users` | CRUD + CSV 导入 |
| 班级 | `GET/POST /classes` | 管理 + 学生分配 |
| 课程 | `GET/POST /courses` | 管理 + 班级关联 |
| 会话 | `GET/POST /sessions` | 签到会话 CRUD |
| 出勤 | `GET /attendances` | 记录查询 + CSV 导出 |
| 统计 | `GET /stats/*` | 多维度统计 |
| 请假 | `GET/POST /leaves` | 申请 + 审批 |
| 课表 | `GET/POST /schedules` | 模板 + 批量生成 |

详见 [API_CONTRACT.md](./API_CONTRACT.md)

## 📡 WebSocket 协议

连接: `ws://localhost:3000/ws?token=<JWT>`

```json
// 客户端订阅签到会话
→ { "type": "subscribe", "payload": { "sessionId": 123 } }

// 学生扫码签到
→ { "type": "check_in", "payload": { "token": "qr_token", "sessionId": 123 } }

// 服务端广播签到状态
← { "type": "user_checked_in", "payload": { "userId": 1, "name": "张三", "status": "present" } }

← { "type": "session_update", "payload": { "checkedIn": 25, "total": 40 } }
```

## 📋 功能清单

### ✅ Phase 1 (已完成)

- [x] JWT 登录 + 四级角色权限
- [x] 用户管理（CRUD + CSV 批量导入导出）
- [x] 年级 / 班级管理 + 学生分配
- [x] 课程管理 + 班级关联
- [x] 签到会话（QR 动态 Token）
- [x] 教师端实时签到面板
- [x] 学生端扫码签到
- [x] 出勤记录查询 + CSV 导出
- [x] WebSocket 实时通信（心跳 + 自动重连）
- [x] 深色 / 浅色模式
- [x] 种子数据 + 测试账号

### 🔜 Phase 2

- [ ] 课表模板 → 批量生成签到会话
- [ ] 请假审批流程（学生提交 → 教师审批）
- [ ] 多维度统计报表（班级 / 课程 / 个人）
- [ ] 定时任务（自动开始 / 结束签到）
- [ ] 补签功能

### 🔮 Phase 3

- [ ] 通知推送（签到提醒 / 缺勤预警）
- [ ] 数据大屏（全校实时出勤率）
- [ ] 学期管理 + 历史数据归档
- [ ] PWA 适配（移动端安装）
- [ ] 开放 API（第三方集成）

## ⚙️ 环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example server/.env
```

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 后端端口 |
| `JWT_SECRET` | — | JWT 密钥（生产环境必须修改） |
| `DB_PATH` | `./attendance.db` | SQLite 数据库路径 |
| `CORS_ORIGIN` | `http://localhost:5173` | 允许的前端域名 |

## 📜 脚本命令

```bash
npm run dev          # 同时启动前后端开发服务器
npm run dev:server   # 仅启动后端 (--watch 热重载)
npm run dev:client   # 仅启动前端 (Vite HMR)
npm run build        # 构建前端生产版本
npm run start        # 启动生产模式后端
npm run install:all  # 安装所有依赖

# 在 server/ 目录下:
npm run seed         # 初始化数据库 + 生成测试数据
```

## 📄 License

MIT
