-- =========================================================
-- 投稿審查系統 資料庫結構 (SQLite)
-- 前端透過 sql.js 在瀏覽器中執行此 SQLite 資料庫，
-- 並將整個資料庫匯出存放於 localStorage 以持久化。
-- =========================================================

-- 使用者（兩種角色：作者 author、編輯 editor）
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    role        TEXT    NOT NULL CHECK (role IN ('author', 'editor'))
);

-- 稿件類別
CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE
);

-- 稿件
-- 審查狀態：編輯中 → 審查中 → 已通過（或 審查中 → 編輯中 退回）
CREATE TABLE IF NOT EXISTS manuscripts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id    INTEGER NOT NULL REFERENCES users(id),
    category_id  INTEGER NOT NULL REFERENCES categories(id),
    title        TEXT    NOT NULL,
    content      TEXT    NOT NULL DEFAULT '',
    status       TEXT    NOT NULL DEFAULT '編輯中'
                 CHECK (status IN ('編輯中', '審查中', '已通過')),
    created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 審查紀錄（每次送審 / 通過 / 退回都留下一筆，方便追蹤）
CREATE TABLE IF NOT EXISTS review_logs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    manuscript_id  INTEGER NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
    user_id        INTEGER NOT NULL REFERENCES users(id),
    action         TEXT    NOT NULL CHECK (action IN ('送出投稿', '通過', '退回')),
    from_status    TEXT    NOT NULL,
    to_status      TEXT    NOT NULL,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ---------------- 預設資料 ----------------
INSERT INTO users (username, password, name, role) VALUES
    ('author1', '1234', '王小明', 'author'),
    ('author2', '1234', '李小華', 'author'),
    ('editor1', '1234', '陳編輯', 'editor');

INSERT INTO categories (name) VALUES
    ('科技'), ('生活'), ('文學'), ('教育'), ('其他');

INSERT INTO manuscripts (author_id, category_id, title, content, status) VALUES
    (1, 1, '生成式 AI 對軟體開發的影響', '近年來生成式 AI 快速發展……', '編輯中'),
    (1, 3, '秋日散文', '風起的時候，落葉……', '審查中'),
    (2, 4, '翻轉教室的實踐心得', '在課堂上導入翻轉教學後……', '審查中'),
    (2, 2, '小資族的理財筆記', '每月固定存下收入的兩成……', '已通過');

INSERT INTO review_logs (manuscript_id, user_id, action, from_status, to_status) VALUES
    (2, 1, '送出投稿', '編輯中', '審查中'),
    (3, 2, '送出投稿', '編輯中', '審查中'),
    (4, 2, '送出投稿', '編輯中', '審查中'),
    (4, 3, '通過',     '審查中', '已通過');
