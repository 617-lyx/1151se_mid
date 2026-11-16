/* =========================================================
 * 資料層 (Model)
 *  - Database：包裝 sql.js（瀏覽器內的 SQLite），負責初始化與持久化
 *  - AuthService：登入 / 登出
 *  - ManuscriptService：稿件的查詢、新增、編輯、刪除與狀態轉換
 * ========================================================= */

const STATUS = Object.freeze({
  EDITING: '編輯中',
  REVIEWING: '審查中',
  APPROVED: '已通過',
});

const ROLE = Object.freeze({ AUTHOR: 'author', EDITOR: 'editor' });

const STORAGE_KEY = 'manuscript_review_db_v1';

class Database {
  constructor(SQL) {
    this.SQL = SQL;
    this.db = null;
  }

  /** 從 localStorage 載入既有資料庫；若沒有則以 schema 建立新的 */
  async init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      this.db = new this.SQL.Database(Database.base64ToBytes(saved));
    } else {
      this.db = new this.SQL.Database();
      this.db.exec(SCHEMA_SQL);
      this.save();
    }
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  /** 將整個資料庫匯出並寫入 localStorage */
  save() {
    localStorage.setItem(STORAGE_KEY, Database.bytesToBase64(this.db.export()));
  }

  /** 清除資料並重建預設資料 */
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.db.close();
    this.db = new this.SQL.Database();
    this.db.exec(SCHEMA_SQL);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.save();
  }

  /** 查詢多筆，回傳物件陣列 */
  query(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  /** 查詢單筆 */
  get(sql, params = []) {
    return this.query(sql, params)[0] || null;
  }

  /** 執行寫入，並自動存檔 */
  run(sql, params = []) {
    this.db.run(sql, params);
    const id = this.get('SELECT last_insert_rowid() AS id').id;
    this.save();
    return id;
  }

  static bytesToBase64(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }

  static base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
}

class AuthService {
  constructor(database) {
    this.database = database;
    this.currentUser = null;
  }

  login(username, password) {
    const user = this.database.get(
      'SELECT id, username, name, role FROM users WHERE username = ? AND password = ?',
      [username, password]
    );
    if (!user) throw new Error('帳號或密碼錯誤');
    this.currentUser = user;
    sessionStorage.setItem('current_user', JSON.stringify(user));
    return user;
  }

  logout() {
    this.currentUser = null;
    sessionStorage.removeItem('current_user');
  }

  restore() {
    const raw = sessionStorage.getItem('current_user');
    this.currentUser = raw ? JSON.parse(raw) : null;
    return this.currentUser;
  }
}

class ManuscriptService {
  constructor(database) {
    this.database = database;
  }

  getCategories() {
    return this.database.query('SELECT id, name FROM categories ORDER BY id');
  }

  /* ---------------- 作者功能 ---------------- */

  /** 查看投稿稿件清單（類別、標題、審查狀態） */
  listByAuthor(authorId) {
    return this.database.query(
      `SELECT m.id, c.name AS category, m.title, m.status, m.updated_at
         FROM manuscripts m JOIN categories c ON c.id = m.category_id
        WHERE m.author_id = ?
        ORDER BY m.updated_at DESC, m.id DESC`,
      [authorId]
    );
  }

  /** 新增投稿（狀態：編輯中） */
  create(authorId, { categoryId, title, content }) {
    ManuscriptService.validate({ categoryId, title, content });
    return this.database.run(
      `INSERT INTO manuscripts (author_id, category_id, title, content, status)
       VALUES (?, ?, ?, ?, ?)`,
      [authorId, categoryId, title.trim(), content, STATUS.EDITING]
    );
  }

  /** 編輯投稿：只有「編輯中」的稿件可以編輯 */
  update(authorId, id, { categoryId, title, content }) {
    ManuscriptService.validate({ categoryId, title, content });
    const m = this.getOwned(authorId, id);
    this.assertStatus(m, STATUS.EDITING, '只有「編輯中」的稿件可以編輯');
    this.database.run(
      `UPDATE manuscripts
          SET category_id = ?, title = ?, content = ?,
              updated_at = datetime('now','localtime')
        WHERE id = ?`,
      [categoryId, title.trim(), content, id]
    );
  }

  /** 刪除編輯中稿件 */
  delete(authorId, id) {
    const m = this.getOwned(authorId, id);
    this.assertStatus(m, STATUS.EDITING, '只有「編輯中」的稿件可以刪除');
    this.database.run('DELETE FROM review_logs WHERE manuscript_id = ?', [id]);
    this.database.run('DELETE FROM manuscripts WHERE id = ?', [id]);
  }

  /** 送出投稿：編輯中 => 審查中 */
  submit(authorId, id) {
    const m = this.getOwned(authorId, id);
    this.transition(m, authorId, '送出投稿', STATUS.EDITING, STATUS.REVIEWING);
  }

  /* ---------------- 編輯功能 ---------------- */

  /** 查看待審查清單（作者、類別、標題） */
  listPending() {
    return this.database.query(
      `SELECT m.id, u.name AS author, c.name AS category, m.title, m.updated_at
         FROM manuscripts m
         JOIN users u ON u.id = m.author_id
         JOIN categories c ON c.id = m.category_id
        WHERE m.status = ?
        ORDER BY m.updated_at ASC, m.id ASC`,
      [STATUS.REVIEWING]
    );
  }

  /** 選擇通過：審查中 => 已通過 */
  approve(editorId, id) {
    this.transition(this.getById(id), editorId, '通過', STATUS.REVIEWING, STATUS.APPROVED);
  }

  /** 退回稿件：審查中 => 編輯中 */
  reject(editorId, id) {
    this.transition(this.getById(id), editorId, '退回', STATUS.REVIEWING, STATUS.EDITING);
  }

  /* ---------------- 共用 ---------------- */

  /** 查看稿件內容 */
  getById(id) {
    const m = this.database.get(
      `SELECT m.*, u.name AS author, c.name AS category
         FROM manuscripts m
         JOIN users u ON u.id = m.author_id
         JOIN categories c ON c.id = m.category_id
        WHERE m.id = ?`,
      [id]
    );
    if (!m) throw new Error('找不到此稿件');
    return m;
  }

  getOwned(authorId, id) {
    const m = this.getById(id);
    if (m.author_id !== authorId) throw new Error('無權限操作此稿件');
    return m;
  }

  getLogs(id) {
    return this.database.query(
      `SELECT l.action, l.from_status, l.to_status, l.created_at, u.name AS user
         FROM review_logs l JOIN users u ON u.id = l.user_id
        WHERE l.manuscript_id = ?
        ORDER BY l.id`,
      [id]
    );
  }

  assertStatus(m, expected, message) {
    if (m.status !== expected) throw new Error(message || `稿件狀態必須為「${expected}」`);
  }

  /** 狀態轉換（集中在此處檢查，確保只有合法的轉換會發生） */
  transition(m, userId, action, from, to) {
    this.assertStatus(m, from, `只有「${from}」的稿件可以${action}`);
    this.database.run(
      `UPDATE manuscripts SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`,
      [to, m.id]
    );
    this.database.run(
      `INSERT INTO review_logs (manuscript_id, user_id, action, from_status, to_status)
       VALUES (?, ?, ?, ?, ?)`,
      [m.id, userId, action, from, to]
    );
  }

  static validate({ categoryId, title, content }) {
    if (!categoryId) throw new Error('請選擇類別');
    if (!title || !title.trim()) throw new Error('請輸入標題');
    if (title.trim().length > 100) throw new Error('標題不可超過 100 字');
    if (content == null) throw new Error('請輸入文章內容');
  }
}
