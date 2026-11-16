/* 執行 database/schema.sql：建立資料庫、資料表與預設資料
 * 用法：npm run init-db
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { config } = require('./db');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  let conn;
  try {
    conn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      charset: 'utf8mb4',
      multipleStatements: true,
    });
    await conn.query(sql);
    console.log(`✔ 資料庫「${config.database}」已建立並匯入預設資料`);
  } catch (err) {
    console.error('✘ 初始化失敗：', err.message);
    console.error('  請確認 MySQL 已啟動，並檢查 .env 中的帳號密碼。');
    process.exitCode = 1;
  } finally {
    if (conn) await conn.end();
  }
})();
