// ==================== 載入必要的套件 ====================
require("dotenv").config(); // 載入 .env 環境變數檔案
const fs = require("fs"); // 檔案系統操作
const path = require("path"); // 路徑處理
const express = require("express"); // Web 框架
const { Pool } = require("pg"); // PostgreSQL 連線池
const admin = require("firebase-admin"); // Firebase Admin SDK
const cors = require("cors"); // 跨域資源共享

// ==================== 初始化 Express 應用 ====================
const app = express();
app.use(cors()); // 允許跨域請求
app.use(express.json()); // 解析 JSON 格式的請求體

// ==================== 環境變數檢查 ====================
// 確保必要的環境變數都有設定，避免連到錯誤的資料庫
if (!process.env.DATABASE_URL) {
  console.error("❌ Missing DATABASE_URL in .env");
  process.exit(1); // 缺少資料庫連線字串，終止程式
}
if (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  console.error("❌ Missing FIREBASE_SERVICE_ACCOUNT_PATH in .env");
  process.exit(1); // 缺少 Firebase 服務帳號路徑，終止程式
}

// ==================== 資料庫連線設定 ====================
// 建立 PostgreSQL 連線池，使用環境變數中的資料庫連線字串
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ==================== Firebase Admin 初始化 ====================
// 讀取 Firebase 服務帳號 JSON 檔案
const saPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
// 使用服務帳號憑證初始化 Firebase Admin
admin.initializeApp({ credential: admin.credential.cert(sa) });

// ==================== 輔助函式：從請求標頭取得 Bearer Token ====================
/**
 * 從 HTTP Authorization 標頭中提取 Bearer token
 * @param {Object} req - Express 請求物件
 * @returns {string|null} - 返回 token 或 null
 */
function getBearerToken(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice("Bearer ".length).trim();
}

// ==================== 中介軟體：記錄所有請求 ====================
// 用於除錯，確認前端是否真的打到這個後端
app.use((req, res, next) => {
  console.log("INCOMING:", req.method, req.url);
  next(); // 繼續處理請求
});

// ==================== API 端點 1：健康檢查 ====================
/**
 * GET /health
 * 檢查伺服器和資料庫狀態，回傳當前連線的資料庫資訊
 */
app.get("/health", async (req, res) => {
  try {
    // 查詢資料庫時間、資料庫名稱、使用者和 schema
    const r = await pool.query(`
      SELECT now() AS db_time,
             current_database() AS db,
             current_user AS db_user,
             current_schema() AS schema
    `);
    res.json({ ok: true, ...r.rows[0] });
  } catch (e) {
    console.error("Health failed:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ==================== API 端點 2：除錯用 - 查看使用者資料 ====================
/**
 * GET /debug/user
 * 開發期間使用，查看 user 資料表中是否有資料
 * 返回最新的 50 筆使用者記錄
 */
app.get("/debug/user", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT "userID", firebase_uid, user_name, use_pic, join_time
      FROM "user"
      ORDER BY "userID" DESC
      LIMIT 50
    `);
    res.json({ ok: true, rows: r.rows });
  } catch (e) {
    console.error("Debug user failed:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ==================== API 端點 3：使用者同步 ====================
/**
 * POST /auth/sync
 * 前端 Google 登入後呼叫此端點
 * 驗證 Firebase ID token 並將使用者資料同步到 PostgreSQL
 */
app.post("/auth/sync", async (req, res) => {
  console.log("[/auth/sync] called", new Date().toISOString());

  // 步驟 1：從請求標頭取得 Bearer token
  const idToken = getBearerToken(req);
  if (!idToken) {
    console.log("[/auth/sync] Missing Bearer token");
    return res.status(401).json({ ok: false, error: "Missing Bearer token" });
  }

  // 步驟 2：驗證 Firebase ID token
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    console.log("[/auth/sync] verifyIdToken failed:", e?.message);
    return res.status(401).json({ 
      ok: false, 
      error: "Invalid Firebase ID token", 
      detail: e?.message 
    });
  }

  // 步驟 3：從 decoded token 中提取使用者資訊
  const firebaseUid = decoded.uid;              // Firebase 使用者 ID（必定存在）
  const email = decoded.email || null;          // 電子郵件（通常存在）
  // 使用者名稱的優先順序：name > displayName > email > "New User"
  const displayName =
    decoded.name ||
    decoded.displayName ||
    email ||
    "New User";

  const photoUrl = decoded.picture || null;     // 大頭照 URL
  const provider = decoded.firebase?.sign_in_provider || null; // 登入提供者（如 google.com）

  console.log("[/auth/sync] decoded:", {
    uid: firebaseUid,
    email,
    name: displayName,
    provider,
  });

  // 步驟 4：將使用者資料插入或更新到資料庫
  // ⚠️ 此 SQL 需要資料庫有 UNIQUE(firebase_uid) 約束才能正常運作
  const sql = `
  INSERT INTO "user" (firebase_uid, user_name, use_pic, join_time)
  VALUES ($1, $2, $3, CURRENT_DATE)
  ON CONFLICT (firebase_uid)
  DO UPDATE SET
    user_name = EXCLUDED.user_name,
    use_pic   = EXCLUDED.use_pic
  RETURNING "userID", firebase_uid, user_name, use_pic, join_time;
`;

  try {
    // 執行 UPSERT（如果存在就更新，不存在就插入）
    const r = await pool.query(sql, [firebaseUid, displayName, photoUrl]);
    console.log("[/auth/sync] UPSERT OK:", r.rows[0]);
    return res.json({ ok: true, user: r.rows[0] });
  } catch (e) {
    // 詳細記錄資料庫錯誤，方便除錯
    console.error("[/auth/sync] DB upsert FAILED:", {
      message: e.message,      // 錯誤訊息
      code: e.code,            // PostgreSQL 錯誤代碼
      detail: e.detail,        // 詳細說明
      constraint: e.constraint,// 違反的約束名稱
    });

    return res.status(500).json({
      ok: false,
      error: "DB upsert failed",
      db: { 
        message: e.message, 
        code: e.code, 
        detail: e.detail, 
        constraint: e.constraint 
      },
    });
  }
});

// ==================== API 端點 4：批次匯入 Firebase 使用者 ====================
/**
 * POST /admin/import-firebase-auth-users
 * 管理員端點：將 Firebase Authentication 中的所有使用者批次匯入 PostgreSQL
 * 適用於初次設定或資料遷移
 */
app.post("/admin/import-firebase-auth-users", async (req, res) => {
  try {
    let imported = 0; // 記錄匯入的使用者數量
    let nextPageToken = undefined; // 分頁 token

    // 使用 while 迴圈處理分頁，每次取 1000 筆使用者
    while (true) {
      // 從 Firebase 取得一批使用者
      const batch = await admin.auth().listUsers(1000, nextPageToken);

      // 逐一處理每個使用者
      for (const u of batch.users) {
        const firebaseUid = u.uid;
        const displayName = u.displayName || u.email || "New User";
        const photoUrl = u.photoURL || null;

        // 將使用者資料插入或更新到資料庫
        await pool.query(
          `
          INSERT INTO "user" (firebase_uid, user_name, use_pic, join_time)
          VALUES ($1, $2, $3, CURRENT_DATE)
          ON CONFLICT (firebase_uid)
          DO UPDATE SET
            user_name = EXCLUDED.user_name,
            use_pic   = EXCLUDED.use_pic
          `,
          [firebaseUid, displayName, photoUrl]
        );

        imported++; // 計數器加 1
      }

      // 取得下一頁的 token
      nextPageToken = batch.pageToken;
      if (!nextPageToken) break; // 沒有更多頁面，跳出迴圈
    }

    res.json({ ok: true, imported });
  } catch (e) {
    console.error("Import failed:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ==================== 啟動伺服器 ====================
// 從環境變數讀取 PORT，預設為 3000
const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`API on http://localhost:${port}`);
});