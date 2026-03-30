// ==================== controllers/authController.js ====================
const admin = require("../config/firebase");
const authService = require("../services/authservice");
const { getBearerToken } = require("../middleware/auth");

exports.syncUser = async (req, res) => {
  console.log("[syncUser] 使用者同步請求", new Date().toISOString());
  
  const idToken = getBearerToken(req);
  
  if (!idToken) {
    console.log("[syncUser] 缺少 Bearer token");
    return res.status(401).json({
      ok: false,
      error: "缺少身份驗證 token"
    });
  }
  
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    console.log("[syncUser] Token 驗證失敗:", error?.message);
    return res.status(401).json({
      ok: false,
      error: "身份驗證失敗",
      detail: error?.message
    });
  }
  
  const firebaseUid = decoded.uid;
  const email = decoded.email || null;
  const displayName =
    decoded.name ||
    decoded.displayName ||
    email ||
    "New User";
  const photoUrl = decoded.picture || null;
  const provider = decoded.firebase?.sign_in_provider || null;
  
  console.log("[syncUser] 使用者資訊:", {
    uid: firebaseUid,
    email,
    name: displayName,
    provider
  });
  
  try {
    const user = await authService.upsertUser({
      firebaseUid,
      displayName,
      photoUrl
    });
    
    console.log("[syncUser] 同步成功:", user);
    
    return res.json({
      ok: true,
      message: "使用者同步成功",
      user: user
    });
  } catch (error) {
    console.error("[syncUser] 資料庫操作失敗:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint
    });
    
    return res.status(500).json({
      ok: false,
      error: "資料庫操作失敗",
      detail: {
        message: error.message,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint
      }
    });
  }
};

exports.importFirebaseUsers = async (req, res) => {
  console.log("[importFirebaseUsers] 開始批次匯入");
  
  try {
    const importedCount = await authService.importAllFirebaseUsers();
    
    console.log(`[importFirebaseUsers] 匯入完成，共 ${importedCount} 位使用者`);
    
    return res.json({
      ok: true,
      message: "批次匯入成功",
      imported: importedCount
    });
  } catch (error) {
    console.error("[importFirebaseUsers] 匯入失敗:", error);
    
    return res.status(500).json({
      ok: false,
      error: "批次匯入失敗",
      detail: error.message
    });
  }
};