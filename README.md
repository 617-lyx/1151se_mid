# 投稿審查系統（軟體工程期中專案）

前端：HTML + CSS + JavaScript　｜　後端：Node.js + Express　｜　資料庫：**MySQL**

## 系統架構

```
瀏覽器 (public/)  ──HTTP/JSON──▶  Express 伺服器 (server/)  ──SQL──▶  MySQL (manuscript_review)
```

- **前端**：`public/` 負責畫面，透過 `api.js` 呼叫後端 REST API
- **後端**：`server/server.js` 提供 API 並檢查登入與角色；商業規則都在 `server/services/manuscriptService.js`
- **資料庫**：MySQL，結構與預設資料在 `database/schema.sql`

## 事前準備

1. 安裝 **Node.js**（LTS 版）：https://nodejs.org
2. 安裝 **MySQL**，擇一：
   - **XAMPP**（最簡單）：https://www.apachefriends.org，打開 XAMPP Control Panel，在 MySQL 那列按 **Start**
   - 或 MySQL Community Server：https://dev.mysql.com/downloads/

## 第一次執行

在專案資料夾開啟終端機（命令提示字元 / PowerShell）：

```bash
# 1. 安裝套件
npm install

# 2. 設定資料庫連線：複製 .env.example 並改名為 .env
#    XAMPP 預設帳號 root、密碼空白，不用改；若你的 MySQL 有密碼，填在 DB_PASSWORD
copy .env.example .env

# 3. 建立資料庫、資料表與預設資料
npm run init-db

# 4. 啟動伺服器
npm start
```

看到 `✔ 伺服器已啟動：http://localhost:3000` 後，用瀏覽器打開 **http://localhost:3000**。

> Windows 也可以直接雙擊：`初始化資料庫.bat`（第 3 步）、`啟動系統.bat`（第 4 步，會自動安裝套件並開啟瀏覽器）。

> 也可以用 phpMyAdmin →「匯入」`database/schema.sql` 來建立資料庫。

### 測試帳號（密碼皆為 `1234`）

| 角色 | 帳號 | 姓名 |
|------|------|------|
| 作者 | `author1` | 王小明 |
| 作者 | `author2` | 李小華 |
| 編輯 | `editor1` | 陳編輯 |

想把資料恢復成初始狀態：再執行一次 `npm run init-db`。

## 功能對照

**作者**
- 查看投稿稿件清單（類別、標題、審查狀態），可依狀態篩選
- 新增 / 編輯投稿（類別、標題、文章內容），狀態為「編輯中」
- 刪除編輯中稿件
- 送出投稿：編輯中 → 審查中

**編輯**
- 查看待審查清單（作者、類別、標題）
- 查看稿件內容
- 選擇通過：審查中 → 已通過
- 退回稿件：審查中 → 編輯中

**稿件審查狀態**：編輯中、審查中、已通過（每次狀態變更都會寫入 `review_logs` 審查紀錄）

### 商業規則（後端檢查，前端繞不過）
- 只有「編輯中」的稿件可以編輯、刪除、送出
- 只有「審查中」的稿件可以通過或退回
- 作者只能操作自己的稿件；編輯看不到尚未送審的稿件
- 作者不能呼叫編輯的 API，反之亦然
- 狀態轉換使用 MySQL **交易 (transaction) + 列鎖定 (SELECT … FOR UPDATE)**，狀態與審查紀錄一起成功或一起失敗

## REST API

| 方法 | 路徑 | 說明 | 角色 |
|------|------|------|------|
| POST | `/api/login` | 登入 | — |
| POST | `/api/logout` | 登出 | — |
| GET | `/api/me` | 目前登入者 | — |
| GET | `/api/categories` | 類別清單 | 已登入 |
| GET | `/api/my/manuscripts` | 我的稿件清單 | 作者 |
| POST | `/api/my/manuscripts` | 新增投稿 | 作者 |
| PUT | `/api/my/manuscripts/:id` | 編輯投稿 | 作者 |
| DELETE | `/api/my/manuscripts/:id` | 刪除編輯中稿件 | 作者 |
| POST | `/api/my/manuscripts/:id/submit` | 送出投稿 | 作者 |
| GET | `/api/reviews` | 待審查清單 | 編輯 |
| POST | `/api/reviews/:id/approve` | 選擇通過 | 編輯 |
| POST | `/api/reviews/:id/reject` | 退回稿件 | 編輯 |
| GET | `/api/manuscripts/:id` | 查看稿件內容（含審查紀錄） | 已登入 |

錯誤時回傳 `{ "error": "訊息" }`，狀態碼：400 輸入錯誤、401 未登入、403 無權限、404 找不到、409 狀態不允許此操作。

## 專案結構

```
├── package.json
├── .env.example            資料庫連線設定範本
├── 初始化資料庫.bat / 啟動系統.bat   Windows 快速執行
├── database/
│   └── schema.sql          MySQL 資料表與預設資料
├── server/
│   ├── server.js           Express 伺服器與 API 路由
│   ├── db.js               MySQL 連線池
│   ├── init-db.js          執行 schema.sql
│   └── services/
│       └── manuscriptService.js   商業邏輯（AuthService、ManuscriptService）
├── public/                 前端
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── api.js          呼叫後端 API
│       └── app.js          畫面與路由
└── docs/uml/               UML 圖（.puml 原始檔 + .png）
```

## UML 圖（docs/uml/）

| 檔案 | 內容 |
|------|------|
| 01_use_case | 使用案例圖 |
| 02_class_diagram | 類別圖 |
| 03_state_diagram | 稿件狀態圖 |
| 04_sequence_author | 循序圖：作者新增並送出投稿 |
| 05_sequence_editor | 循序圖：編輯審查稿件 |
| 06_er_diagram | 資料庫 ER 圖 |
| 07_deployment | 部署圖 |

`.puml` 檔可用 PlantUML（VS Code 的 PlantUML 擴充，或 https://www.plantuml.com/plantuml）修改後重新產生圖片。

## 常見問題

- **`✘ 無法連線到 MySQL`**：MySQL 沒啟動（XAMPP 要按 Start），或 `.env` 的密碼不對。
- **`Unknown database 'manuscript_review'`**：還沒執行 `npm run init-db`。
- **`EADDRINUSE :3000`**：已經有另一個伺服器在跑，關掉它或在 `.env` 改 `PORT`。
