-- =========================================================
-- 投稿審查系統 資料庫 (PostgreSQL)
-- 在 pgAdmin 的 Query Tool 開啟此檔執行，或：
--   psql -U postgres -d mydb -f review.sql
-- 注意：會先刪除舊的 articles、users 資料表再重建
-- =========================================================

-- 先刪 articles（它參考 users），再刪 users，順序反過來會失敗
DROP TABLE IF EXISTS "public"."articles";
DROP TABLE IF EXISTS "public"."users";

-- 使用者：兩種角色 author(作者)、editor(編輯)
CREATE TABLE "public"."users" (
    "id"       character varying(15) PRIMARY KEY,          -- 帳號
    "pwd"      character varying(30) NOT NULL,             -- 密碼
    "nickname" character varying(30) NOT NULL,             -- 暱稱（畫面上顯示的名字）
    "role"     character varying(10) NOT NULL
               CHECK ("role" IN ('author', 'editor'))
);

-- 稿件
CREATE TABLE "public"."articles" (
    "aid"        serial PRIMARY KEY,                                      -- 稿件編號（自動遞增）
    "author"     character varying(15) NOT NULL REFERENCES users(id),     -- 作者帳號（外鍵）
    "category"   character varying(20) NOT NULL,                          -- 類別
    "title"      character varying(100) NOT NULL,                         -- 標題
    "content"    text NOT NULL,                                           -- 文章內容
    "status"     character varying(10) NOT NULL DEFAULT '編輯中'          -- 審查狀態
                 CHECK ("status" IN ('編輯中', '審查中', '已通過')),
    "updated_at" timestamp NOT NULL DEFAULT now()                         -- 最後更新時間
);

-- 預設資料（密碼都是 123）
INSERT INTO "public"."users" ("id", "pwd", "nickname", "role") VALUES
('john',   '123', '約翰',   'author'),
('mary',   '123', '馬麗',   'author'),
('editor', '123', '總編輯', 'editor');

INSERT INTO "public"."articles" ("author", "category", "title", "content", "status") VALUES
('john', '科技', 'AI 在農業的應用',   '介紹 AI 如何協助農民判斷作物病害。', '編輯中'),
('john', '生活', '埔里的秋天',        '介紹埔里秋天值得去的地方。',         '審查中'),
('mary', '教育', '大學生的時間管理',  '分享時間管理的小技巧。',             '審查中'),
('mary', '文學', '雨夜隨筆',          '窗外的雨下了一整夜……',               '已通過');
