# 投稿審查系統（軟體工程期中專案）

**Python FastAPI + Jinja2 模板 + PostgreSQL**（依課堂範例的寫法）

## 系統架構

```
瀏覽器  ──HTTP GET/POST──▶  FastAPI (main.py, port 8000)  ──SQL──▶  PostgreSQL (port 5432, 資料庫 mydb)
                              ├─ routes/login.py   /user/...
                              ├─ routes/author.py  /author/...
                              └─ routes/editor.py  /editor/...
```

## 執行步驟

### 1. 建立資料庫
1. 啟動 PostgreSQL，打開 **pgAdmin**
2. 在 `mydb` 資料庫上按右鍵 → **Query Tool**
3. 開啟 `review.sql` 並執行（▶）。會建立 `users`、`articles`、`reviews` 三張表與測試資料

> 如果你的 PostgreSQL 密碼不是 `123456` 或資料庫不叫 `mydb`，改 `db.py` 裡的 `DB_URL`。

### 2. 安裝套件並啟動
在專案資料夾開終端機：

```bash
pip install -r requirements.txt
fastapi dev main.py
```

看到 `✅ Connected to DB` 後，打開 **http://127.0.0.1:8000**

> Windows 也可以直接雙擊 `啟動系統.bat`。

### 測試帳號（密碼都是 `123`）

| 角色 | 帳號 | 暱稱 |
|------|------|------|
| 作者 | `john` | 約翰 |
| 作者 | `mary` | 馬麗 |
| 編輯 | `editor` | 總編輯 |

也可以在登入頁按「註冊」建立新帳號。想恢復初始資料：重新執行一次 `review.sql`。

## 功能與網址對照

| 功能 | 方法 | 網址 | 檔案 |
|------|------|------|------|
| 登入 | POST | `/user/login` | routes/login.py |
| 登出 | GET | `/user/logout` | routes/login.py |
| 註冊 | POST | `/user/register` | routes/login.py |
| **作者**：查看投稿稿件清單（類別、標題、審查狀態） | GET | `/author/list` | routes/author.py |
| 新增投稿（類別、標題、文章大綱、文章內容）：顯示表單 / 存檔（狀態：編輯中） | GET / POST | `/author/new` → `/author/add` | routes/author.py |
| 編輯投稿：顯示表單 / 存檔 | GET / POST | `/author/edit/{aid}` → `/author/update` | routes/author.py |
| 刪除編輯中稿件 | POST | `/author/delete/{aid}` | routes/author.py |
| 送出投稿：編輯中 → 審查中 | POST | `/author/submit/{aid}` | routes/author.py |
| 查看自己的稿件內容 | GET | `/author/view/{aid}` | routes/author.py |
| **編輯**：查看待審查清單（作者、類別、標題、文章大綱） | GET | `/editor/list` | routes/editor.py |
| 查看已審查稿件（審查結果：通過 / 退回，可篩選） | GET | `/editor/reviewed` | routes/editor.py |
| 查看稿件內容 | GET | `/editor/view/{aid}` | routes/editor.py |
| 選擇通過：審查中 → 已通過（並寫入審查紀錄） | POST | `/editor/pass/{aid}` | routes/editor.py |
| 退回稿件：審查中 → 編輯中（並寫入審查紀錄） | POST | `/editor/reject/{aid}` | routes/editor.py |

### 權限與狀態怎麼控制
- `chkLogin("author")` / `chkLogin("editor")`：沒登入導回登入頁，角色不對回 403
- SQL 的 `WHERE` 一律加上條件，例如送出投稿：
  `UPDATE articles SET status='審查中' WHERE aid=%s AND author=%s AND status='編輯中'`
  → 只有「自己的」「編輯中」稿件會被改到；`rowcount` 是 0 就顯示錯誤訊息
- 通過 / 退回時，「改稿件狀態」和「新增審查紀錄」用 **transaction（交易）** 包起來，兩個動作一起成功或一起取消
- 退回後稿件會變回「編輯中」，作者清單會顯示「被退回」標籤，稿件頁面也看得到審查紀錄
- 資料庫也有 `CHECK` 限制：`role` 只能是 author/editor，`status` 只能是三種狀態

## 專案結構

```
├── main.py              建立 FastAPI、掛上 router、session、靜態檔
├── db.py                PostgreSQL 連線池（lifespan、getDB）
├── auth.py              chkLogin：檢查登入與角色
├── common.py            共用：templates、類別清單、flash 提示訊息
├── routes/
│   ├── login.py         登入 / 登出 / 註冊
│   ├── author.py        作者功能
│   └── editor.py        編輯功能
├── templates/           Jinja2 模板（伺服器把資料填進去再回傳）
│   ├── base.html        共用版面（其他頁面 extends 它）
│   ├── authorList.html  作者稿件清單
│   ├── articleEdit.html 新增 / 編輯表單（共用）
│   ├── articleView.html 稿件內容（作者、編輯共用）
│   ├── editorList.html  待審查清單
│   ├── editorReviewed.html 已審查稿件
│   └── error.html       錯誤頁
├── www/                 靜態檔案（網址 /w/...）
│   ├── login.html
│   ├── register.html
│   └── style.css
├── review.sql           資料表與測試資料
├── requirements.txt     Python 套件
└── docs/uml/            UML 圖
```

## UML 圖（docs/uml/）

使用案例圖、類別圖、狀態圖、兩張循序圖（作者送出投稿、編輯審查）、ER 圖、部署圖。`.puml` 可用 PlantUML 修改後重新產生。
