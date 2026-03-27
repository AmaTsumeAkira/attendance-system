const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '192.168.0.113',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'nocobase',
  database: process.env.DB_NAME || 'nocobase',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE) || 10
});

module.exports = pool;
