# 投稿審查系統（軟體工程期中專案）

純前端實作（HTML + CSS + JavaScript），資料庫使用 **SQLite**，透過 [sql.js](https://github.com/sql-js/sql.js) 在瀏覽器內執行，資料自動存於瀏覽器的 localStorage，不需要安裝任何伺服器。

## 如何執行

1. 解壓縮後，直接用瀏覽器（Chrome / Edge / Firefox）**雙擊開啟 `app/index.html`** 即可。
2. 使用測試帳號登入（密碼皆為 `1234`）：

| 角色 | 帳號 | 姓名 |
|------|------|------|
| 作者 | `author1` | 王小明 |
| 作者 | `author2` | 李小華 |
| 編輯 | `editor1` | 陳編輯 |

> 想恢復初始資料：在登入頁按「重置資料庫」。

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

**稿件審查狀態**：編輯中、審查中、已通過（每次狀態變更都會寫入審查紀錄）

### 商業規則（在 `ManuscriptService` 中檢查）
- 只有「編輯中」的稿件可以編輯、刪除、送出
- 只有「審查中」的稿件可以通過或退回
- 作者只能操作自己的稿件；編輯看不到尚未送審的稿件

## 專案結構

```
app/
├── index.html            主頁面
├── css/style.css         樣式
├── database/schema.sql   資料庫結構與預設資料（SQLite）
└── js/
    ├── lib/sql-asm.js    sql.js（SQLite 的 JavaScript 版本）
    ├── schema.js         schema.sql 內嵌成字串（file:// 無法讀取 .sql 檔）
    ├── db.js             資料層：Database、AuthService、ManuscriptService
    └── app.js            畫面層：路由與各頁面
docs/uml/                 UML 圖（.puml 原始檔 + .png）
```

## 架構

- **畫面層（app.js）**：以 hash 路由切換頁面（登入、作者清單、新增/編輯、待審查清單、稿件內容）
- **服務層（db.js）**：`AuthService` 處理登入；`ManuscriptService` 處理稿件 CRUD 與狀態轉換，所有狀態轉換集中於 `transition()` 檢查
- **資料層（db.js）**：`Database` 包裝 sql.js，每次寫入後把整個 SQLite 資料庫匯出存到 localStorage

## UML 圖（docs/uml/）

| 檔案 | 內容 |
|------|------|
| 01_use_case | 使用案例圖 |
| 02_class_diagram | 類別圖 |
| 03_state_diagram | 稿件狀態圖 |
| 04_sequence_author | 循序圖：作者新增並送出投稿 |
| 05_sequence_editor | 循序圖：編輯審查稿件 |
| 06_er_diagram | 資料庫 ER 圖 |

`.puml` 檔可用 PlantUML（或 VS Code 的 PlantUML 擴充、https://www.plantuml.com/plantuml）修改後重新產生圖片。

> 注意：修改 `database/schema.sql` 後，需同步更新 `js/schema.js` 裡的字串，並按「重置資料庫」才會生效。
