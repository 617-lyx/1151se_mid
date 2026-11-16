-- =========================================================
-- 投稿審查系統 資料庫結構 (MySQL / MariaDB)
-- 執行方式（擇一）：
--   1. npm run init-db
--   2. phpMyAdmin →「匯入」此檔案
--   3. mysql -u root -p < database/schema.sql
-- 注意：會先刪除舊的 manuscript_review 資料庫再重建
-- =========================================================

DROP DATABASE IF EXISTS manuscript_review;
CREATE DATABASE manuscript_review
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE manuscript_review;

-- 使用者（兩種角色：作者 author、編輯 editor）
CREATE TABLE users (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  username  VARCHAR(50)  NOT NULL UNIQUE,
  password  VARCHAR(100) NOT NULL,
  name      VARCHAR(50)  NOT NULL,
  role      ENUM('author', 'editor') NOT NULL
) ENGINE=InnoDB;

-- 稿件類別
CREATE TABLE categories (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- 稿件
-- 審查狀態：編輯中 → 審查中 → 已通過（或 審查中 → 編輯中 退回）
CREATE TABLE manuscripts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  author_id    INT NOT NULL,
  category_id  INT NOT NULL,
  title        VARCHAR(100) NOT NULL,
  content      TEXT NOT NULL,
  status       ENUM('編輯中', '審查中', '已通過') NOT NULL DEFAULT '編輯中',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ms_author   FOREIGN KEY (author_id)   REFERENCES users(id),
  CONSTRAINT fk_ms_category FOREIGN KEY (category_id) REFERENCES categories(id),
  INDEX idx_ms_status (status)
) ENGINE=InnoDB;

-- 審查紀錄（每次送審 / 通過 / 退回都留下一筆）
CREATE TABLE review_logs (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  manuscript_id  INT NOT NULL,
  user_id        INT NOT NULL,
  action         ENUM('送出投稿', '通過', '退回') NOT NULL,
  from_status    ENUM('編輯中', '審查中', '已通過') NOT NULL,
  to_status      ENUM('編輯中', '審查中', '已通過') NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_ms   FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  CONSTRAINT fk_log_user FOREIGN KEY (user_id)       REFERENCES users(id)
) ENGINE=InnoDB;

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
