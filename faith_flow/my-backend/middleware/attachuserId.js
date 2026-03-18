// ==================== middleware/attachUserId.js ====================
const pool = require("../config/database");

async function attachUserId(req, res, next) {
  try {
    const firebaseUid = req.user?.uid;
    if (!firebaseUid) {
      return res.status(401).json({ ok: false, error: "缺少 Firebase UID" });
    }

    // 用 firebase uid 找到你系統內的 int userID
    const r = await pool.query(
      `SELECT "userID" FROM "user" WHERE "firebase_uid" = $1`,
      [firebaseUid]
    );

    if (r.rowCount === 0) {
      return res.status(401).json({
        ok: false,
        error: "使用者不存在，請先建立 user 資料（firebase_uid 對應 userID）",
      });
    }

    req.userId = r.rows[0].userID; // ⭐ 這個是 int
    return next();
  } catch (err) {
    console.error("[attachUserId] failed:", err);
    return res.status(500).json({ ok: false, error: "取得使用者失敗" });
  }
}

module.exports = attachUserId;