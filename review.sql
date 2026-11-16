-- =========================================================
-- 投稿審查系統 資料庫 (PostgreSQL)
-- 在 pgAdmin 的 Query Tool 開啟此檔執行，或：
--   psql -U postgres -d mydb -f review.sql
-- 注意：會先刪除舊的 reviews、articles、users 資料表再重建
-- =========================================================

-- 刪除順序：reviews（參考 articles、users）→ articles（參考 users）→ users
DROP TABLE IF EXISTS "public"."reviews";
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
    "outline"    character varying(500) NOT NULL DEFAULT '',              -- 文章大綱
    "content"    text NOT NULL,                                           -- 文章內容
    "status"     character varying(10) NOT NULL DEFAULT '編輯中'          -- 審查狀態
                 CHECK ("status" IN ('編輯中', '審查中', '已通過')),
    "updated_at" timestamp NOT NULL DEFAULT now()                         -- 最後更新時間
);

-- 審查紀錄：編輯每次「通過」或「退回」都記一筆
-- （退回後稿件狀態會變回「編輯中」，所以要另外記錄審查結果）
CREATE TABLE "public"."reviews" (
    "rid"         serial PRIMARY KEY,                                                -- 紀錄編號
    "aid"         integer NOT NULL REFERENCES articles(aid) ON DELETE CASCADE,       -- 哪篇稿件（稿件刪除時紀錄一起刪）
    "editor"      character varying(15) NOT NULL REFERENCES users(id),               -- 哪位編輯審的
    "result"      character varying(4) NOT NULL CHECK ("result" IN ('通過', '退回')), -- 審查結果
    "reviewed_at" timestamp NOT NULL DEFAULT now()                                   -- 審查時間
);

-- 預設資料（密碼都是 123）
INSERT INTO "public"."users" ("id", "pwd", "nickname", "role") VALUES
('john',   '123', '約翰',   'author'),
('mary',   '123', '馬麗',   'author'),
('editor', '123', '總編輯', 'editor');

INSERT INTO "public"."articles" ("author", "category", "title", "outline", "content", "status") VALUES
('john', '科技', 'AI 在農業的應用',  '一、作物病害的問題　二、AI 影像辨識　三、實際案例與限制', '介紹 AI 如何協助農民判斷作物病害。', '編輯中'),
('john', '生活', '埔里的秋天',       '介紹埔里秋天的三個景點與在地美食',                         '介紹埔里秋天值得去的地方。',         '審查中'),
('mary', '教育', '大學生的時間管理', '一、常見的拖延原因　二、番茄鐘工作法　三、每週規劃',       '分享時間管理的小技巧。',             '審查中'),
('mary', '文學', '雨夜隨筆',         '以一場夜雨寫對家鄉的思念',                                 '窗外的雨下了一整夜……',               '已通過');

-- 審查紀錄範例：「AI 在農業的應用」曾被退回，「雨夜隨筆」已通過
INSERT INTO "public"."reviews" ("aid", "editor", "result", "reviewed_at") VALUES
(1, 'editor', '退回', now() - interval '2 day'),
(4, 'editor', '通過', now() - interval '1 day');
