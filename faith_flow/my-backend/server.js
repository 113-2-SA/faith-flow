// ==================== server.js ====================
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

// ==================== 中介軟體設定 ====================
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});


// ==================== 環境變數檢查 ====================
if (!process.env.DATABASE_URL) {
  console.error("❌ 缺少環境變數: DATABASE_URL");
  process.exit(1);
}
if (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  console.error("❌ 缺少環境變數: FIREBASE_SERVICE_ACCOUNT_PATH");
  process.exit(1);
}

// ==================== 初始化設定檔 ====================
require("./config/database");
require("./config/firebase");

// ==================== 匯入路由 ====================
const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/routesauth");
const userRoutes = require("./routes/user"); // 新增使用者個人資料相關的路由
const diaryRoutes = require("./routes/diarys"); // 新增日記相關的路由
const chatRoutes = require("./routes/chat");

console.log("[DEBUG] ✅ 所有路由已 require");
console.log("[DEBUG] chatRoutes type:", typeof chatRoutes);
console.log("[DEBUG] chatRoutes methods:", Object.keys(chatRoutes));

// ==================== 註冊路由 ====================

// 健康檢查
app.use("/health", healthRoutes);

// 除錯端點（保持原有的 /debug/user 路徑）
app.get("/debug/user", async (req, res) => {
  try {
    const authService = require("./services/authservice");
    const users = await authService.getAllUsers(50);
    res.json({ ok: true, count: users.length, rows: users });
  } catch (error) {
    console.error("Debug user failed:", error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// 使用者個人資料路由
app.use("/api/user", userRoutes);

// 日記相關路由
console.log("[MOUNT] 掛載 /api/diary");
app.use("/api/diary", diaryRoutes);

// ⭐ DEBUG: 攔截所有進入 /api/chat 的請求
app.use("/api/chat", (req, res, next) => {
  console.log("[CHAT INTERCEPT] 進入 /api/chat");
  console.log("[CHAT INTERCEPT] 方法:", req.method);
  console.log("[CHAT INTERCEPT] 完整路徑:", req.path);
  console.log("[CHAT INTERCEPT] 完整 URL:", req.originalUrl);
  console.log("[CHAT INTERCEPT] req.url:", req.url);
  next();
});

console.log("[MOUNT] 掛載 /api/chat");
app.use("/api/chat", chatRoutes);
console.log("[MOUNT] ✅ /api/chat 掛載完成");

// 認證相關的路由
// POST /auth/sync
app.use("/auth", authRoutes);

// 管理員相關的路由
// POST /admin/import-firebase-auth-users
app.use("/admin", authRoutes);


// app.use("/api/diary", require("./routes/diarys"));
// ⭐⭐⭐ 測試端點（加在這裡，在 404 之前）⭐⭐⭐
app.post("/test/diary", async (req, res) => {
  try {
    console.log('📥 測試端點收到:', req.body);
    
    const diaryService = require("./services/diaryservice");
    
    const diary = await diaryService.createDiary({
      userId: 'test-user-123',
      diaryDate: req.body.diaryDate || '2025-12-26',
      diaryTitle: req.body.diaryTitle || '測試標題',
      diaryContent: req.body.diaryContent || '測試內容',
      bibleQuote: req.body.bibleQuote || null,
      tags: req.body.tags || null,
      collectId: 0
    });
    
    console.log('✅ 測試建立成功:', diary);
    
    res.json({
      ok: true,
      message: '測試建立成功',
      data: diary
    });
  } catch (error) {
    console.error('❌ 測試失敗:', error);
    res.status(500).json({
      ok: false,
      error: error.message,
      detail: {
        message: error.message,
        code: error.code,
        detail: error.detail
      }
    });
  }
});

// server.js 上方確保有引入
const { verifyToken } = require("./middleware/auth");
const attachUserId = require("./middleware/attachuserId");
const pool = require("./config/database"); // 依你實際路徑

// === DEBUG: 印出每一個 SQL（用來抓出是哪一段還在用 firebase_uid）===
const _query = pool.query.bind(pool);

pool.query = async (text, params) => {
  try {
    // 只要有提到 diary 或 firebase_uid 就印（避免 log 太爆）
    const t = String(text);
    if (/diary/i.test(t) || /firebase_uid/i.test(t)) {
      console.log("🧾 [DB QUERY]", t);
      console.log("🧾 [DB PARAMS]", params);
    }

    return await _query(text, params);
  } catch (err) {
    console.error("❌ [DB ERROR]", err.message);
    console.error("🧾 [DB ERROR QUERY]", text);
    console.error("🧾 [DB ERROR PARAMS]", params);
    // 印出呼叫堆疊，直接看到是哪個檔案呼叫的
    console.error("📌 [CALL STACK]", new Error().stack);
    throw err;
  }
};

app.get("/api/diary", verifyToken, attachUserId, async (req, res) => {
  try {
    console.log("🔥 HIT /api/diary IN server.js", __filename);
    console.log("🔥 req.userId =", req.userId, " type=", typeof req.userId);

    const userId = req.userId; // ⭐ int（對應 "user"."userID"）

    const result = await pool.query(
      `SELECT
         diary_id,
         collect_id,
         diary_title,
         diary_content,
         tags,
         bible_quote,
         created_at,
         diary_date,
         user_id
       FROM diary
       WHERE user_id = $1
       ORDER BY diary_date DESC, created_at DESC`,
      [userId]
    );

    return res.json({ ok: true, data: result.rows });
  } catch (err) {
    console.error("[GET /api/diary] failed:", err);
    return res.status(500).json({
      ok: false,
      error: "取得日記失敗",
      detail: err.message,
    });
  }
});



// ==================== 根路徑 ====================
app.get("/", (req, res) => {
  res.json({
    message: "✝️ Faith-Flow API Server",
    version: "1.0.0",
    status: "running"
  });
});

// ==================== 404 處理 ====================
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "API 端點不存在",
    path: req.url,
    availableEndpoints: [
      "GET  /health",
      "GET  /debug/user",
      "POST /auth/sync",
      "POST /admin/import-firebase-auth-users"
    ]
  });
});

// ==================== 全域錯誤處理 ====================
app.use((err, req, res, next) => {
  console.error("伺服器錯誤:", err);
  res.status(err.status || 500).json({
    ok: false,
    error: err.message || "伺服器內部錯誤"
  });
});

// ==================== 啟動伺服器 ====================
const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log("✝️  ==========================================");
  console.log("✝️  Faith-Flow API Server");
  console.log(`✝️  Running on: http://localhost:${port}`);
  console.log("✝️  ==========================================");
  console.log("📍 Available API endpoints:");
  console.log("   GET  /health");
  console.log("   GET  /debug/user");
  console.log("   POST /auth/sync");
  console.log("   POST /admin/import-firebase-auth-users");
  console.log("✝️  ==========================================");
});

