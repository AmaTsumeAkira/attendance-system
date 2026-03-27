# Attendance System API Contract

## Base URL
- REST: `http://localhost:3000/api/v1`
- WebSocket: `ws://localhost:3000/ws`
- Client Dev: `http://localhost:5173` (Vite dev server proxies to :3000)

## Authentication
- JWT in `Authorization: Bearer <token>` header
- WebSocket: token in query `ws://host/ws?token=<jwt>`
- Token expiry: 24h, refresh endpoint available

## Roles
- `super_admin`, `admin`, `teacher`, `student`

## REST Endpoints

### Auth
- `POST /auth/login` — body: `{ username, password }` → `{ token, user }`
- `POST /auth/refresh` — → new token
- `GET /auth/me` — → current user
- `POST /auth/change-password` — body: `{ oldPassword, newPassword }`

### Users
- `GET /users?role=&class_id=&search=&page=&limit=` — list
- `POST /users` — create
- `GET /users/:id` — detail
- `PUT /users/:id` — update
- `DELETE /users/:id` — soft delete
- `POST /users/import` — CSV bulk import (multipart)
- `GET /users/template` — download CSV template

### Grades
- `GET /grades` — list
- `POST /grades` — create
- `PUT /grades/:id` — update
- `DELETE /grades/:id` — delete

### Classes
- `GET /classes` — list (with grade_name)
- `POST /classes` — create
- `GET /classes/:id` — detail with students
- `PUT /classes/:id` — update
- `DELETE /classes/:id` — delete
- `POST /classes/:id/students` — body: `{ userIds: [] }`
- `DELETE /classes/:id/students/:uid` — remove student

### Courses
- `GET /courses` — list
- `POST /courses` — create
- `GET /courses/:id` — detail with classes
- `PUT /courses/:id` — update
- `DELETE /courses/:id` — delete
- `POST /courses/:id/classes` — body: `{ classIds: [], semester }`

### Sessions (签到会话)
- `GET /sessions?date=&course_id=&class_id=&status=`
- `POST /sessions` — create
- `GET /sessions/:id` — detail with attendance stats
- `PUT /sessions/:id` — update
- `POST /sessions/:id/start` — start attendance, generate QR token
- `POST /sessions/:id/end` — end attendance
- `DELETE /sessions/:id` — cancel

### Attendances
- `GET /attendances?session_id=&date=&class_id=&status=&page=`
- `GET /attendances/my` — student's own records
- `PUT /attendances/:id` — manual update (补签)
- `GET /attendances/export?start_date=&end_date=&class_id=` — CSV

### Stats
- `GET /stats/overview?date=` — today overview
- `GET /stats/class/:id?start=&end=` — class stats
- `GET /stats/course/:id?start=&end=` — course stats
- `GET /stats/student/:id?month=` — student personal stats

### Leaves
- `GET /leaves?status=&user_id=` — list
- `POST /leaves` — submit
- `GET /leaves/:id` — detail
- `PUT /leaves/:id/review` — body: `{ status: 'approved'|'rejected', comment }`
- `PUT /leaves/:id/cancel` — cancel by student

### Schedules
- `GET /schedules?course_id=&class_id=&semester=`
- `POST /schedules` — create template
- `PUT /schedules/:id` — update
- `DELETE /schedules/:id` — delete
- `POST /schedules/generate` — body: `{ semester, startDate, endDate }`

## WebSocket Messages

### Client → Server
```json
{ "type": "subscribe", "payload": { "sessionId": 123 } }
{ "type": "check_in", "payload": { "token": "qr_token", "sessionId": 123 }, "reqId": "uuid" }
{ "type": "get_stats", "payload": { "sessionId": 123 } }
{ "type": "ping" }
```

### Server → Client
```json
{ "type": "session_update", "payload": { "sessionId", "status", "checkedIn", "total", "recentUsers" } }
{ "type": "check_in_result", "payload": { "success", "status", "message }, "reqId": "uuid" }
{ "type": "user_checked_in", "payload": { "userId", "name", "status", "time } }
{ "type": "stats_update", "payload": { ... } }
{ "type": "pong" }
{ "type": "error", "payload": { "message } }
```

## Response Format
```json
// Success
{ "code": 0, "data": { ... }, "message": "ok" }

// Error
{ "code": 400, "message": "错误描述" }

// Paginated
{ "code": 0, "data": { "items": [...], "total": 100, "page": 1, "limit": 20 } }
```

## Status Values
- Attendance: `present`, `absent`, `late`, `leave`
- Session: `scheduled`, `active`, `ended`, `cancelled`
- Leave: `pending`, `approved`, `rejected`, `cancelled`
- User: `active`, `disabled`, `graduated`
