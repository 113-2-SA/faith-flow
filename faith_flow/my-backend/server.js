// ==================== server.js ====================
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

// ==================== 中介軟體設定 ====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// ==================== 匯入模組（Classes）====================
const db = require('./config/database');
const WeeklySummaryService = require('./services/weeklysummaryservice');
const WeeklySummaryController = require('./controllers/weeklysummarycontroller');
const Scheduler = require('./services/scheduler');
const errorHandler = require('./middleware/errorhandle');

// ==================== 初始化服務和控制器（正確順序）====================
// ⭐ 1. 先初始化 Service
const weeklySummaryService = new WeeklySummaryService(db);

// ⭐ 2. 再初始化 Controller
const weeklySummaryController = new WeeklySummaryController(weeklySummaryService, null);

// ⭐ 3. 最後初始化 Scheduler
const scheduler = new Scheduler(weeklySummaryService);

// ⭐ 4. 將 scheduler 注入到 controller（如果需要手動觸發）
weeklySummaryController.scheduler = scheduler;

// ⭐ 5. 啟動定時任務
scheduler.start();

// ==================== 優雅關閉 ====================
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信號，正在關閉...');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信號，正在關閉...');
  scheduler.stop();
  process.exit(0);
});

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
const conversationRoutes = require('./routes/conversation');
const messageRoutes = require('./routes/message');
const weeklySummaryRoutes = require('./routes/weeklysummary');

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

// 對話相關路由
app.use('/api/conversation', conversationRoutes);

// 訊息相關路由
app.use('/api', messageRoutes);

// ⭐ 周回顧路由
app.use('/api/weekly-summary', weeklySummaryRoutes(weeklySummaryController));

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
      "POST /admin/import-firebase-auth-users",
      "GET  /api/weekly-summary",
      "POST /api/weekly-summary/generate"
    ]
  });
});

// ==================== 全域錯誤處理 ====================
app.use(errorHandler);

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
  console.log("   POST /auth/sync");
  console.log("   POST /admin/import-firebase-auth-users");
  console.log("   GET  /api/weekly-summary");
  console.log("   POST /api/weekly-summary/generate");
  console.log("✝️  ==========================================");
  console.log("📅 定時任務已啟動：每週日 02:00 自動生成周回顧");
});

module.exports = app;