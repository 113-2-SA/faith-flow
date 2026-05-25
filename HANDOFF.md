# Faith Flow 開發交接文件（2026-05-25）

## 重要原則：資料來源

**所有 schema 查詢一律直接連 Supabase，不讀本地 SQL 檔**
（init.sql / ffpostgre_2.sql / my_data.sql 與實際資料庫不同步，已有欄位落差）

連線字串在 `faith_flow/my-backend/.env` 的 `DIRECT_URL`。

---

## Supabase 實際 Schema（活水泉源相關）

### `weekly_cards`
| 欄位 | 型別 |
|------|------|
| weekly_cards_id | bigint PK |
| weekly_start_date | date |
| day_no | integer（1~5）|
| ai_question_id | bigint FK → ai_questions |
| created_at | timestamptz |

### `ai_questions`
| 欄位 | 型別 |
|------|------|
| ai_question_id | bigint PK |
| question_text | text |
| theme | varchar |
| quote | text |
| quote_source | text |
| image_url | text |
| image_prompt | text |
| source_hint | text |
| depth | integer |
| is_active | boolean |
| is_ready | boolean |

### `user_draws`
| 欄位 | 型別 |
|------|------|
| user_draws_id | bigint PK |
| user_id | bigint |
| weekly_card_id | bigint FK → weekly_cards |
| created_at | timestamptz |
| summary | text（AI 生成的對話摘要）|
| is_completed | boolean |
| conversation_id | integer |

> **注意**：`letters` 表在 Supabase **不存在**。本地 SQL 檔有寫但從未建立。

---

## 活水泉源完整流程

```
後台每週建 5 筆 weekly_cards（day_no 1~5，各指定 ai_question_id）
     ↓
GET /weekly-cards → JOIN ai_questions → 前端顯示 5 張卡
     ↓
使用者點卡片 → POST /record-draw → 建立 user_draws（is_completed=false）
     ↓
POST /chat（SSE）→ 活水泉源對話
     ↓
使用者結束 → summary.tsx → POST /generate-letter → AI 生成 summary 文字
     ↓
letter.tsx 顯示信箋 → POST /complete-draw → 更新 user_draws（summary、conversation_id、is_completed=true）
     ↓
GET /my-collection → JOIN weekly_cards JOIN ai_questions → 收藏頁顯示卡片
```

---

## 本次 Session 完成的修改（commit c5ffa454）

### 根本問題：程式碼引用不存在的欄位/表
原本程式碼假設有 `letters` 表、`drawdate`、`letter_quote`、`letter_quote_source`、`card_style_id` 欄位，全部在 Supabase 不存在，導致所有寫入與查詢會報錯。

### 修改清單

| 檔案 | 修改內容 |
|------|---------|
| `livingwatercontroller.js` | `recordDrawController`：移除 `drawdate`；`getWeeklyCardsController`：移除 `card_style_id`；`completeDrawController`：只更新 summary/conversation_id/is_completed，刪除整段 letters 寫入；`getMyDrawsController`：移除不存在欄位與 JOIN letters；`getMyCollectionController`：同上，`drawdate` 改 `created_at`；`getLetterController` 改寫為 `getDrawController`（用 user_draws_id JOIN 三表） |
| `routes/livingwater.js` | `/letter/:letter_id` → `/draw/:user_draws_id` |
| `livingwaterservice.js` | `generate-letter` 只要求 AI 回傳 `summary`，移除 quote/quote_source/image_prompt |
| `app/drawcard/letter.tsx` | 移除 letterId state、letter_quote/letter_quote_source POST body |
| `app/drawcard/summary.tsx` | 移除 imagePrompt/quote/quoteSource state；JSX 改用 `params.quote`/`params.quote_source` |
| `app/drawcard/collection.tsx` | CardItem type 移除 letter_id/drawdate，新增 created_at；shareToFire 直接導到 /community/create |

---

## 關鍵 API 路徑（目前有效）

| 功能 | 路徑 | 登入 |
|------|------|------|
| 本週卡片 | GET /api/livingwater/weekly-cards | 否 |
| 今日卡片 | GET /api/livingwater/daily-card | 否 |
| 本週抽卡狀態 | GET /api/livingwater/my-draws | 是 |
| 累積收藏 | GET /api/livingwater/my-collection | 是 |
| 記錄抽卡 | POST /api/livingwater/record-draw | 是 |
| 完成流程 | POST /api/livingwater/complete-draw | 是 |
| 抽卡詳情 | GET /api/livingwater/draw/:user_draws_id | 是 |
| 活水對話 | POST /api/livingwater/chat（SSE）| 是 |
| 生成摘要 | POST /api/livingwater/generate-letter | 是 |

---

## 尚未處理 / 可能需要繼續的事項

1. **社群分享**：`collection.tsx` 的「分享到心靈營火」目前直接導到 `/community/create`，沒帶任何卡片資料。如果社群貼文需要帶入信箋內容，需要用 `user_draws_id` 串接。
2. **`user_cards` 表**：Supabase 有此表但後端完全未使用，確認是否可廢棄。
3. **`GET /draw/:user_draws_id`**：已建好但前端目前無使用，可在需要重新展示某筆信箋時呼叫。

---

## 啟動方式

```bash
# 後端
cd faith_flow/my-backend
node index.js

# 前端
cd faith_flow
npx expo start
# 或 web
npx expo start --web
```

**後端更新後必須重啟才生效。**
