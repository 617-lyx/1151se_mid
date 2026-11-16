/* =========================================================
 * 後端伺服器（Express）
 *  - 提供 REST API 給前端呼叫
 *  - 同時提供 public/ 底下的前端網頁
 * 啟動：npm start  →  http://localhost:3000
 * ========================================================= */
require('dotenv').config({ quiet: true });
const path = require('path');
const express = require('express');
const session = require('express-session');
const { pool, config } = require('./db');
const { AuthService, ManuscriptService, HttpError, ROLE } = require('./services/manuscriptService');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'se-midterm-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' },
  })
);
app.use(express.static(path.join(__dirname, '..', 'public')));

/* ---------------- 中介函式 ---------------- */

/** 包裝 async 路由，錯誤統一交給錯誤處理器 */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** 檢查已登入，且（若有指定）角色正確 */
const requireRole = (role) => (req, res, next) => {
  const user = req.session.user;
  if (!user) return next(new HttpError(401, '請先登入'));
  if (role && user.role !== role) return next(new HttpError(403, '沒有權限'));
  next();
};

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, '稿件編號錯誤');
  return id;
};

/* ---------------- 登入 / 登出 ---------------- */

app.post('/api/login', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  const user = await AuthService.login(String(username || ''), String(password || ''));
  req.session.user = user;
  res.json(user);
}));

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => res.json(req.session.user || null));

app.get('/api/categories', requireRole(), wrap(async (req, res) => {
  res.json(await ManuscriptService.getCategories());
}));

/* ---------------- 作者 API ---------------- */

const author = express.Router();
author.use(requireRole(ROLE.AUTHOR));

// 查看投稿稿件清單
author.get('/', wrap(async (req, res) => {
  res.json(await ManuscriptService.listByAuthor(req.session.user.id));
}));
// 新增投稿
author.post('/', wrap(async (req, res) => {
  const id = await ManuscriptService.create(req.session.user.id, req.body);
  res.status(201).json({ id });
}));
// 編輯投稿
author.put('/:id', wrap(async (req, res) => {
  await ManuscriptService.update(req.session.user.id, idParam(req), req.body);
  res.json({ ok: true });
}));
// 刪除編輯中稿件
author.delete('/:id', wrap(async (req, res) => {
  await ManuscriptService.remove(req.session.user.id, idParam(req));
  res.json({ ok: true });
}));
// 送出投稿
author.post('/:id/submit', wrap(async (req, res) => {
  await ManuscriptService.submit(req.session.user.id, idParam(req));
  res.json({ ok: true });
}));

app.use('/api/my/manuscripts', author);

/* ---------------- 編輯 API ---------------- */

const editor = express.Router();
editor.use(requireRole(ROLE.EDITOR));

// 查看待審查清單
editor.get('/', wrap(async (req, res) => {
  res.json(await ManuscriptService.listPending());
}));
// 選擇通過
editor.post('/:id/approve', wrap(async (req, res) => {
  await ManuscriptService.approve(req.session.user.id, idParam(req));
  res.json({ ok: true });
}));
// 退回稿件
editor.post('/:id/reject', wrap(async (req, res) => {
  await ManuscriptService.reject(req.session.user.id, idParam(req));
  res.json({ ok: true });
}));

app.use('/api/reviews', editor);

/* ---------------- 共用：查看稿件內容 ---------------- */

app.get('/api/manuscripts/:id', requireRole(), wrap(async (req, res) => {
  res.json(await ManuscriptService.getForUser(req.session.user, idParam(req)));
}));

/* ---------------- 錯誤處理 ---------------- */

app.use('/api', (req, res) => res.status(404).json({ error: '找不到此 API' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: '伺服器錯誤：' + err.message });
});

/* ---------------- 啟動 ---------------- */

(async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`✔ 已連線到 MySQL：${config.user}@${config.host}:${config.port}/${config.database}`);
  } catch (err) {
    console.error('✘ 無法連線到 MySQL：', err.message);
    console.error('  1. 確認 MySQL（或 XAMPP 的 MySQL）已啟動');
    console.error('  2. 確認已執行 npm run init-db 建立資料庫');
    console.error('  3. 檢查 .env 中的帳號密碼');
    process.exit(1);
  }
  app.listen(PORT, () => console.log(`✔ 伺服器已啟動：http://localhost:${PORT}`));
})();
