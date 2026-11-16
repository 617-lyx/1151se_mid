/* 資料庫連線（MySQL 連線池） */
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'manuscript_review',
};

const pool = mysql.createPool({
  ...config,
  charset: 'utf8mb4',
  dateStrings: true, // 日期直接以字串回傳，避免時區轉換
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = { pool, config };
