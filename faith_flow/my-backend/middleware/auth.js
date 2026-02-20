// ==================== middleware/auth.js ====================
const admin = require("../config/firebase");

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

async function verifyToken(req, res, next) {
  console.log("[verifyToken] 開始驗證 token");
  
  const idToken = getBearerToken(req);
  
  if (!idToken) {
    console.log("[verifyToken] 缺少 Bearer token");
    return res.status(401).json({
      ok: false,
      error: "未提供身份驗證 token"
    });
  }
  
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || decoded.displayName,
      picture: decoded.picture,
      provider: decoded.firebase?.sign_in_provider
    };
    
    console.log("[verifyToken] Token 驗證成功:", req.user.uid);
    next();
  } catch (error) {
    console.error("[verifyToken] Token 驗證失敗:", error.message);
    return res.status(401).json({
      ok: false,
      error: "身份驗證失敗",
      detail: error.message
    });
  }
}

module.exports = {
  getBearerToken,
  verifyToken
};