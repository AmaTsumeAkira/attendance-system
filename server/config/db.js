const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '192.168.0.113',
  user: 'root',
  password: 'nocobase', // 替换为你的 MySQL root 密码
  database: 'nocobase',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;