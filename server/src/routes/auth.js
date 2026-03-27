import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { successRes, errorRes, nowStr } from '../utils/helpers.js';

const router = Router();

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json(errorRes(400, '用户名和密码不能为空'));
    }
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json(errorRes(401, '用户名或密码错误'));
    }
    if (user.status === 'disabled') {
      return res.status(403).json(errorRes(403, '账号已被禁用'));
    }
    if (!bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json(errorRes(401, '用户名或密码错误'));
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowStr(), user.id);
    const { password_hash, ...safeUser } = user;
    res.json(successRes({ token, user: safeUser }));
  } catch (err) {
    res.status(500).json(errorRes(500, err.message));
  }
});

router.post('/refresh', authMiddleware, (req, res) => {
  try {
    const token = jwt.sign(
      { id: req.user.id, username: req.user.username, role: req.user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );
    res.json(successRes({ token }));
  } catch (err) {
    res.status(500).json(errorRes(500, err.message));
  }
});

router.get('/me', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json(errorRes(404, '用户不存在'));
    const { password_hash, ...safeUser } = user;
    res.json(successRes(safeUser));
  } catch (err) {
    res.status(500).json(errorRes(500, err.message));
  }
});

router.post('/change-password', authMiddleware, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json(errorRes(400, '旧密码和新密码不能为空'));
    }
    if (newPassword.length < 6) {
      return res.status(400).json(errorRes(400, '新密码长度不能少于6位'));
    }
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
      return res.status(400).json(errorRes(400, '旧密码错误'));
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(hash, nowStr(), req.user.id);
    res.json(successRes(null, '密码修改成功'));
  } catch (err) {
    res.status(500).json(errorRes(500, err.message));
  }
});

export default router;
