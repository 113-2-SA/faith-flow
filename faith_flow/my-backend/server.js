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
const userRoutes = require("./routes/user");

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

// 認證相關的路由
// POST /auth/sync
app.use("/auth", authRoutes);

// 管理員相關的路由
// POST /admin/import-firebase-auth-users
app.use("/admin", authRoutes);

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