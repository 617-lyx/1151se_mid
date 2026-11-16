/* =========================================================
 * 業務邏輯層：稿件與登入
 * 所有商業規則（誰能做什麼、狀態怎麼轉換）都在這裡檢查
 * ========================================================= */
const { pool } = require('../db');

const STATUS = Object.freeze({
  EDITING: '編輯中',
  REVIEWING: '審查中',
  APPROVED: '已通過',
});

const ROLE = Object.freeze({ AUTHOR: 'author', EDITOR: 'editor' });

/** 帶 HTTP 狀態碼的錯誤，路由層會轉成對應的回應 */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ---------------- 登入 ---------------- */

const AuthService = {
  async login(username, password) {
    const [rows] = await pool.query(
      'SELECT id, username, name, role FROM users WHERE username = ? AND password = ?',
      [username, password]
    );
    if (rows.length === 0) throw new HttpError(401, '帳號或密碼錯誤');
    return rows[0];
  },
};

/* ---------------- 稿件 ---------------- */

const ManuscriptService = {
  async getCategories() {
    const [rows] = await pool.query('SELECT id, name FROM categories ORDER BY id');
    return rows;
  },

  /* ===== 作者功能 ===== */

  /** 查看投稿稿件清單（類別、標題、審查狀態） */
  async listByAuthor(authorId) {
    const [rows] = await pool.query(
      `SELECT m.id, c.name AS category, m.title, m.status, m.updated_at
         FROM manuscripts m JOIN categories c ON c.id = m.category_id
        WHERE m.author_id = ?
        ORDER BY m.updated_at DESC, m.id DESC`,
      [authorId]
    );
    return rows;
  },

  /** 新增投稿（狀態：編輯中） */
  async create(authorId, data) {
    const { categoryId, title, content } = validate(data);
    const [result] = await pool.query(
      `INSERT INTO manuscripts (author_id, category_id, title, content, status)
       VALUES (?, ?, ?, ?, ?)`,
      [authorId, categoryId, title, content, STATUS.EDITING]
    );
    return result.insertId;
  },

  /** 編輯投稿：只有「編輯中」的稿件可以編輯 */
  async update(authorId, id, data) {
    const { categoryId, title, content } = validate(data);
    const m = await this.getOwned(authorId, id);
    assertStatus(m, STATUS.EDITING, '只有「編輯中」的稿件可以編輯');
    await pool.query(
      'UPDATE manuscripts SET category_id = ?, title = ?, content = ? WHERE id = ?',
      [categoryId, title, content, id]
    );
  },

  /** 刪除編輯中稿件 */
  async remove(authorId, id) {
    const m = await this.getOwned(authorId, id);
    assertStatus(m, STATUS.EDITING, '只有「編輯中」的稿件可以刪除');
    await pool.query('DELETE FROM manuscripts WHERE id = ?', [id]); // review_logs 會 CASCADE 刪除
  },

  /** 送出投稿：編輯中 => 審查中 */
  async submit(authorId, id) {
    await this.getOwned(authorId, id);
    await transition(id, authorId, '送出投稿', STATUS.EDITING, STATUS.REVIEWING);
  },

  /* ===== 編輯功能 ===== */

  /** 查看待審查清單（作者、類別、標題） */
  async listPending() {
    const [rows] = await pool.query(
      `SELECT m.id, u.name AS author, c.name AS category, m.title, m.updated_at
         FROM manuscripts m
         JOIN users u ON u.id = m.author_id
         JOIN categories c ON c.id = m.category_id
        WHERE m.status = ?
        ORDER BY m.updated_at ASC, m.id ASC`,
      [STATUS.REVIEWING]
    );
    return rows;
  },

  /** 選擇通過：審查中 => 已通過 */
  async approve(editorId, id) {
    await transition(id, editorId, '通過', STATUS.REVIEWING, STATUS.APPROVED);
  },

  /** 退回稿件：審查中 => 編輯中 */
  async reject(editorId, id) {
    await transition(id, editorId, '退回', STATUS.REVIEWING, STATUS.EDITING);
  },

  /* ===== 共用 ===== */

  async getById(id) {
    const [rows] = await pool.query(
      `SELECT m.*, u.name AS author, c.name AS category
         FROM manuscripts m
         JOIN users u ON u.id = m.author_id
         JOIN categories c ON c.id = m.category_id
        WHERE m.id = ?`,
      [id]
    );
    if (rows.length === 0) throw new HttpError(404, '找不到此稿件');
    return rows[0];
  },

  async getOwned(authorId, id) {
    const m = await this.getById(id);
    if (m.author_id !== authorId) throw new HttpError(403, '無權限操作此稿件');
    return m;
  },

  /** 查看稿件內容：作者只能看自己的；編輯不能看尚未送審的 */
  async getForUser(user, id) {
    const m = user.role === ROLE.AUTHOR ? await this.getOwned(user.id, id) : await this.getById(id);
    if (user.role === ROLE.EDITOR && m.status === STATUS.EDITING) {
      throw new HttpError(403, '此稿件尚未送審，編輯無法查看');
    }
    const [logs] = await pool.query(
      `SELECT l.action, l.from_status, l.to_status, l.created_at, u.name AS user
         FROM review_logs l JOIN users u ON u.id = l.user_id
        WHERE l.manuscript_id = ?
        ORDER BY l.id`,
      [id]
    );
    return { ...m, logs };
  },
};

/* ---------------- 內部函式 ---------------- */

function assertStatus(m, expected, message) {
  if (m.status !== expected) throw new HttpError(409, message || `稿件狀態必須為「${expected}」`);
}

/**
 * 狀態轉換：使用交易 (transaction) + 列鎖定 (FOR UPDATE)，
 * 確保兩個人同時操作時不會發生不合法的轉換，且狀態與紀錄一起成功或一起失敗。
 */
async function transition(id, userId, action, from, to) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT id, status FROM manuscripts WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) throw new HttpError(404, '找不到此稿件');
    assertStatus(rows[0], from, `只有「${from}」的稿件可以${action}`);
    await conn.query('UPDATE manuscripts SET status = ? WHERE id = ?', [to, id]);
    await conn.query(
      `INSERT INTO review_logs (manuscript_id, user_id, action, from_status, to_status)
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, action, from, to]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function validate({ categoryId, title, content } = {}) {
  categoryId = Number(categoryId);
  title = typeof title === 'string' ? title.trim() : '';
  if (!categoryId) throw new HttpError(400, '請選擇類別');
  if (!title) throw new HttpError(400, '請輸入標題');
  if (title.length > 100) throw new HttpError(400, '標題不可超過 100 字');
  if (typeof content !== 'string') throw new HttpError(400, '請輸入文章內容');
  return { categoryId, title, content };
}

module.exports = { AuthService, ManuscriptService, HttpError, STATUS, ROLE };
