# 考勤系统 v2.0

完整的在线考勤管理系统，支持 QR 码签到、角色权限、统计报表。

## 技术栈

- **前端**: React 19 + Vite + react-router-dom + recharts
- **后端**: Node.js + Express + SQLite (better-sqlite3)
- **实时通信**: WebSocket
- **认证**: JWT + bcryptjs

## 快速开始

```bash
# 安装所有依赖
npm run install:all

# 初始化数据库 + 种子数据
cd server && npm run seed && cd ..

# 开发模式（前后端同时启动）
npm run dev
```

- 前端: http://localhost:5173
- 后端: http://localhost:3000

## 测试账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 超级管理员 |
| teacher1 | teacher123 | 教师 |
| teacher2 | teacher123 | 教师 |
| student01~10 | student123 | 学生 |

## 功能模块

### Phase 1 (已完成)
- ✅ JWT 登录/角色权限系统
- ✅ 用户管理（CRUD + CSV 批量导入）
- ✅ 班级/年级管理
- ✅ 课程管理
- ✅ 签到会话（QR 码签到）
- ✅ 出勤记录查询/导出
- ✅ WebSocket 实时通信
- ✅ 深色/浅色模式

### Phase 2
- 课表模板 → 批量生成签到会话
- 请假审批流程
- 多维度统计报表
- 定时任务

### Phase 3
- 补签功能
- 通知推送
- 数据大屏
- PWA 适配

## 项目结构

```
attendance-system/
├── server/              # 后端
│   └── src/
│       ├── index.js     # 入口
│       ├── db.js        # SQLite 初始化
│       ├── middleware/   # JWT 鉴权
│       ├── routes/      # REST API
│       ├── ws/          # WebSocket 处理
│       └── seed.js      # 测试数据
├── client/              # 前端 (React)
│   └── src/
│       ├── api/         # API 调用层
│       ├── components/  # 通用组件
│       ├── pages/       # 页面组件
│       ├── hooks/       # 自定义 Hooks
│       └── context/     # React Context
├── API_CONTRACT.md      # API 接口文档
└── .env.example         # 环境变量模板
```
