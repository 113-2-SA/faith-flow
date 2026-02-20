// ==================== services/userService.js ====================
// 使用者個人資料相關的資料庫操作

const pool = require("../config/database");

/**
 * 根據 Firebase UID 取得使用者完整資料
 */
async function getUserProfile(firebaseUid) {
  const result = await pool.query(
    `SELECT "userID", firebase_uid, user_name, use_pic, profile, join_time
     FROM "user"
     WHERE firebase_uid = $1`,
    [firebaseUid]
  );
  return result.rows[0] || null;
}

/**
 * 更新使用者的 profile（自我介紹）
 */
async function updateUserProfile(firebaseUid, profile) {
  const result = await pool.query(
    `UPDATE "user"
     SET profile = $1
     WHERE firebase_uid = $2
     RETURNING "userID", firebase_uid, user_name, use_pic, profile, join_time`,
    [profile, firebaseUid]
  );
  return result.rows[0] || null;
}

/**
 * 更新使用者的完整個人資料
 */
async function updateUserInfo(firebaseUid, updates) {
  const { userName, usePic, profile } = updates;
  
  // 動態建立 SQL（只更新有提供的欄位）
  const fields = [];
  const values = [];
  let paramCount = 1;
  
  if (userName !== undefined) {
    fields.push(`user_name = $${paramCount}`);
    values.push(userName);
    paramCount++;
  }
  
  if (usePic !== undefined) {
    fields.push(`use_pic = $${paramCount}`);
    values.push(usePic);
    paramCount++;
  }
  
  if (profile !== undefined) {
    fields.push(`profile = $${paramCount}`);
    values.push(profile);
    paramCount++;
  }
  
  if (fields.length === 0) {
    throw new Error("沒有要更新的欄位");
  }
  
  // 加入 firebase_uid 作為最後一個參數
  values.push(firebaseUid);
  
  const sql = `
    UPDATE "user"
    SET ${fields.join(", ")}
    WHERE firebase_uid = $${paramCount}
    RETURNING "userID", firebase_uid, user_name, use_pic, profile, join_time
  `;
  
  const result = await pool.query(sql, values);
  return result.rows[0] || null;
}

module.exports = {
  getUserProfile,
  updateUserProfile,
  updateUserInfo
};