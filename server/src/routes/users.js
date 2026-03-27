import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { getDb } from '../db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { successRes, errorRes, paginatedRes, nowStr, toCsv, validateRequired } from '../utils/helpers.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

// GET /users
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { role, class_id, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (role) { where += ' AND role = ?'; params.push(role); }
    if (search) { where += ' AND (username LIKE ? OR real_name LIKE ? OR student_id LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (class_id) {
      where += ' AND id IN (SELECT user_id FROM class_students WHERE class_id = ?)';
      params.push(class_id);
    }
    const total = db.prepare(`SELECT COUNT(*) as c FROM users ${where}`).get(...params).c;
    const items = db.prepare(`SELECT id, username, real_name, role, student_id, phone, email, status, last_login_at, created_at, updated_at FROM users ${where} ORDER BY id LIMIT ? OFFSET ?`).all(...params, Number(limit), Number(offset));
    res.json(paginatedRes(items, total, page, limit));
  } catch (err) {
    res.status(500).json(errorRes(500, err.message));
  }
});

// GET /users/template
router.get('/template', (req, res) => {
  const csv = 'username,password,real_name,role,student_id,phone,email\nstudent01,123456,张三,student,2024001,13800000001,zhang@example.com';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=user_template.csv');
  res.send(csv);
});

// POST /users/import
router.post('/import', requireRole('super_admin', 'admin'), upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json(errorRes(400, '请上传CSV文件'));
    const db = getDb();
    const content = req.file.buffer.toString('utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return res.status(400).json(errorRes(400, 'CSV文件格式错误'));
    const headers = lines[0].split(',').map(h => h.trim());
    const results = { success: 0, failed: 0, errors: [] };
    const insert = db.prepare('INSERT INTO users (username, password_hash, real_name, role, student_id, phone, email, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)');
    const txn = db.transaction(() => {
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
        try {
          if (!row.username || !row.password) throw new Error('缺少必填字段');
          const hash = bcrypt.hashSync(row.password, 10);
          const t = nowStr();
          insert.run(row.username, hash, row.real_name || '', row.role || 'student', row.student_id || '', row.phone || '', row.email || '', 'active', t, t);
          results.success++;
        } catch (e) {
          results.failed++;
          results.errors.push(`第${i + 1}行: ${e.message}`);
        }
      }
    });
    txn();
    res.json(successRes(results));
  } catch (err) {
    res.status(500).json(errorRes(500, err.message));
  }
});

// POST /users
router.post('/', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const { username, password, real_name, role, student_id, phone, email } = req.body;
    const missing = validateRequired(['username', 'password', 'real_name'], req.body);
    if (missing.length) return res.status(400).json(errorRes(400, `缺少必填字段: ${missing.join(', ')}`));
    const db = getDb();
    const exist = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exist) return res.status(409).json(errorRes(409, '用户名已存在'));
    const hash = bcrypt.hashSync(password, 10);
    const t = nowStr();
    const result = db.prepare('INSERT INTO users (username, password_hash, real_name, role, student_id, phone, email, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(username, hash, real_name, role || 'student', student_id || '', phone || '', email || '', 'active', t, t);
    const user = db.prepare('SELECT id, username, real_name, role, student_id, phone, email, status, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.json(successRes(user, '创建成功'));
  } catch (err) {
    res.status(500).json(errorRes(500, err.message));
  }
});

// GET /users/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, username, real_name, role, student_id, phone, email, status, last_login_at, created_at, updated_at FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json(errorRes(404, '用户不存在'));
    res.json(successRes(user));
  } catch (err) {
    res.status(500).json(errorRes(500, err.message));
  }
});

// PUT /users/:id
router.put('/:id', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json(errorRes(404, '用户不存在'));
    const { real_name, role, student_id, phone, email, status, password } = req.body;
    const t = nowStr();
    let hash = user.password_hash;
    if (password) hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET real_name=?, role=?, student_id=?, phone=?, email=?, status=?, password_hash=?, updated_at=? WHERE id=?').run(
      real_name ?? user.real_name, role ?? user.role, student_id ?? user.student_id,
      phone ?? user.phone, email ?? user.email, status ?? user.status, hash, t, req.params.id
    );
    const updated = db.prepare('SELECT id, username, real_name, role, student_id, phone, email, status, created_at, updated_at FROM users WHERE id = ?').get(req.params.id);
    res.json(successRes(updated, '更新成功'));
  } catch (err) {
    res.status(500).json(errorRes(500, err.message));
  }
});

// DELETE /users/:id
router.delete('/:id', requireRole('super_admin', 'admin'), (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json(errorRes(404, '用户不存在'));
    db.prepare("UPDATE users SET status = 'disabled', updated_at = ? WHERE id = ?").run(nowStr(), req.params.id);
    res.json(successRes(null, '已禁用'));
  } catch (err) {
    res.status(500).json(errorRes(500, err.message));
  }
});

export default router;
