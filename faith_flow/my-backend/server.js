// ==================== server.js ====================
// 開發環境 SSL 相容性修正（Node.js v22 + Windows undici fetch 握手問題）
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const { setGlobalDispatcher, Agent } = require('undici');
  setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }));
}
require("dotenv").config();
const express = require("express");
const http = require("http"); // ⭐ 新增：用於建立 HTTP server
const WebSocket = require("ws"); // ⭐ 新增：WebSocket 支援
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

// ⭐ 6. 啟動時補生成上周漏掉的統整（延遲 5 秒等資料庫連線穩定）
setTimeout(() => scheduler.checkAndBackfillLastWeek(), 5000);

// ⭐ 用於儲存 server 和 wss 實例（優雅關閉時使用）
let server, wss;

// ==================== 優雅關閉 ====================
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信號，正在關閉...');
  scheduler.stop();
  if (wss) {
    wss.close(() => {
      if (server) {
        server.close(() => {
          console.log('✅ Server 已安全關閉');
          process.exit(0);
        });
      }
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('收到 SIGINT 信號，正在關閉...');
  scheduler.stop();
  if (wss) {
    wss.close(() => {
      if (server) {
        server.close(() => {
          console.log('✅ Server 已安全關閉');
          process.exit(0);
        });
      }
    });
  } else {
    process.exit(0);
  }
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
const searchRoutes = require('./routes/search');
const liturgicalRoutes = require('./routes/liturgical');
const nudgeRoutes = require('./routes/nudge');
const chatRoutes = require("./routes/chat");

console.log("[DEBUG] ✅ 所有路由已 require");
console.log("[DEBUG] chatRoutes type:", typeof chatRoutes);
console.log("[DEBUG] chatRoutes methods:", Object.keys(chatRoutes));
const livingwaterRoutes = require('./routes/livingwater'); // 活水泉源路由

// ==================== 註冊路由 ====================

// 健康檢查
app.use("/health", healthRoutes);

// 除錯：測試 multipart 檔案上傳是否正常
app.post("/debug/upload-test", require('./middleware/picupload').uploadSingleImage, (req, res) => {
  console.log('📋 debug/upload-test req.body:', req.body);
  console.log('📋 debug/upload-test req.file:', req.file
    ? { fieldname: req.file.fieldname, originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size, hasBuffer: !!req.file.buffer }
    : undefined
  );
  res.json({
    ok: true,
    body: req.body,
    file: req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      hasBuffer: !!req.file.buffer,
    } : null,
  });
});

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
console.log("[MOUNT] 掛載 /api/diary");
app.use("/api/diary", diaryRoutes);

// 貼文相關路由
app.use('/api/post', postRoutes);
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

app.use('/api/search', searchRoutes);

// 禮儀年曆路由
app.use('/api/liturgical', liturgicalRoutes);

// 禱告回顧光點路由
app.use('/api/nudge', nudgeRoutes);

// 活水泉源相關路由
app.use('/api/livingwater', livingwaterRoutes);

// ==================== 臨時測試端點（確認 AI 流程可用後可刪除）====================
app.post("/debug/ai-pipeline", async (req, res) => {
  const { diary_id, user_id } = req.body;
  if (!diary_id || !user_id) {
    return res.status(400).json({ ok: false, error: '需要 diary_id 和 user_id' });
  }

  const pool = require('./config/database');
  const { processDiary, findSimilar } = require('./services/aiPrayerService');
  const report = {};

  // Step 0: 確認日記存在
  const diaryRes = await pool.query(
    'SELECT diary_id, diary_content, user_id FROM diary WHERE diary_id = $1 AND user_id = $2',
    [diary_id, user_id]
  );
  if (diaryRes.rowCount === 0) return res.status(404).json({ ok: false, error: '找不到日記' });
  report.step0_diary_found = true;
  const content = diaryRes.rows[0].diary_content;

  // Step 1: embedding + 情緒分析 + 寫入 DB（各自獨立回報）
  let embedding = null;
  try {
    embedding = await processDiary(diary_id, content, user_id);
    report.step1_ok = true;
    report.step1_embedding_dim = embedding.length;
  } catch (e) {
    report.step1_error = e.message;
  }

  // Step 2: 找相似日記（直接用記憶體中的 embedding，不重讀 DB）
  if (embedding) {
    try {
      const { similar_diaries, should_analyze } = await findSimilar(diary_id, user_id, embedding);
      report.step2_similar_count = similar_diaries.length;
      report.step2_similar_diaries = similar_diaries;
      report.step2_should_analyze = should_analyze;
    } catch (e) {
      report.step2_error = e.message;
    }
  }

  // 目前 clusters / nudges 筆數
  const [cc, nc] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM prayer_clusters WHERE user_id = $1', [user_id]),
    pool.query('SELECT COUNT(*) FROM prayer_nudges WHERE user_id = $1', [user_id]),
  ]);
  report.prayer_clusters_count = parseInt(cc.rows[0].count);
  report.prayer_nudges_count = parseInt(nc.rows[0].count);

  res.json({ ok: true, report });
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
  "POST /admin/import-firebase-auth-users",
  "GET  /api/weekly-summary",
  "POST /api/weekly-summary/generate",
  "POST /api/diary/from-prayer",
  "POST /api/diary/preview-prayer",
  "POST /api/livingwater/generate-letter",
  "POST /api/livingwater/generate-image"
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

// ⭐ 建立 HTTP server（不能直接用 app.listen）
server = http.createServer(app);

// ⭐ 建立 WebSocket Server（用於語音轉錄）
wss = new WebSocket.Server({ 
  server,
  path: '/ws/transcribe'
});

// ⭐ 匯入轉錄服務
const transcriptionService = require('./services/transervice');

console.log('🎙️ WebSocket 轉錄服務初始化中...');

// ⭐ 處理 WebSocket 連線
wss.on('connection', (ws, req) => {
  console.log('🙏 [WebSocket] 新的轉錄連線');
  transcriptionService.handleConnection(ws);
});

wss.on('error', (error) => {
  console.error('❌ [WebSocket] Server 錯誤:', error);
});

// ⭐ 使用 server.listen 而不是 app.listen
server.listen(port, () => {
  console.log("✝️  ==========================================");
  console.log("✝️  Faith-Flow API Server");
  console.log(`✝️  HTTP API: http://localhost:${port}`);
  console.log(`✝️  WebSocket: ws://localhost:${port}/ws/transcribe`); // ⭐ 新增
  console.log("✝️  ==========================================");
  console.log("📍 Available API endpoints:");
  console.log("   GET  /health");
  console.log("   GET  /debug/user");
  console.log("   POST /auth/sync");
  console.log("   POST /admin/import-firebase-auth-users");
  console.log("   GET  /api/weekly-summary");
  console.log("   POST /api/weekly-summary/generate");
  console.log("   POST /api/diary/from-prayer"); 
  console.log("   POST /api/diary/preview-prayer"); 
  console.log("   POST /api/livingwater/generate-letter");
  console.log("   POST /api/livingwater/generate-image");
  console.log("✝️  ==========================================");
  console.log("📅 定時任務已啟動：每週日 02:00 自動生成周回顧");
  console.log("🎙️ 語音轉錄服務已啟動：WebSocket 連線可用");
});

module.exports = app;