// ==================== server.js ====================
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

// ==================== 中介軟體設定 ====================
app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
// 需安裝npm install express-validator(未安裝)

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
const userRoutes = require("./routes/user");
const diaryRoutes = require("./routes/diarys");
const postRoutes = require('./routes/post');
const commentRoutes = require('./routes/comment');
const commentLikeRoutes = require('./routes/clike');
const likeRoutes = require('./routes/like');
const shareRoutes = require('./routes/share');
const livingwaterRoutes = require('./routes/livingwater'); // 活水泉源路由

// ==================== 註冊路由 ====================

// 健康檢查
app.use("/health", healthRoutes);

// 除錯端點
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
app.use("/api/diary", diaryRoutes);

// 貼文相關路由
app.use('/api/post', postRoutes);

// 認證相關的路由
app.use("/api/auth", authRoutes);

// 管理員相關的路由
app.use("/api/admin", authRoutes);

// 留言相關路由
app.use('/api/comments', commentRoutes);

// 留言點讚相關路由
app.use('/api/comment-likes', commentLikeRoutes);

// 點讚相關路由
app.use('/api/like', likeRoutes);

// 轉發相關路由
app.use('/api/share', shareRoutes);

// 活水泉源相關路由
app.use('/api/livingwater', livingwaterRoutes);

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
      "POST /api/auth/sync",
      "POST /api/admin/import-firebase-auth-users",
      "POST /api/livingwater/generate-letter",
      "POST /api/livingwater/generate-image"
    ]
  });
});

// ==================== 全域錯誤處理 ====================
app.use((err, req, res, next) => {
  console.error("伺服器錯誤:", err.stack);
  res.status(err.status || 500).json({
    ok: false,
    error: err.message || "伺服器內部錯誤",
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
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
  console.log("   POST /api/auth/sync");
  console.log("   POST /api/livingwater/generate-letter");
  console.log("   POST /api/livingwater/generate-image");
  console.log("✝️  ==========================================");
});

module.exports = app;