// ==================== services/diaryservice.js ====================
const pool = require("../config/database");

async function getUserIDByFirebaseUid(firebase_uid) {
  const r = await pool.query(
    `SELECT "userID" FROM "user" WHERE "firebase_uid" = $1`,
    [firebase_uid]
  );
  if (r.rowCount === 0) {
    throw new Error(`user 表找不到 firebase_uid=${firebase_uid} 的使用者`);
  }
  return r.rows[0].userID;
}

/**
 * 建立日記（自動記錄使用者）
 * diaryData.userId 目前是 firebase uid（從 Controller 傳來）
 */
async function createDiary(diaryData) {
  console.log("📝 [createDiary] 收到資料:", diaryData);

  const {
    userId,
    diaryDate,
    diaryTitle,
    diaryContent,
    bibleQuote,
    tags,
    collectId,
  } = diaryData;

  // 支援 snake_case
  const firebaseUid = userId || diaryData.firebase_uid;
  const finalDiaryDate =
    diaryDate || diaryData.diary_date || new Date().toISOString().split("T")[0];
  const finalDiaryTitle = diaryTitle || diaryData.diary_title;
  const finalDiaryContent = diaryContent || diaryData.diary_content;
  const finalBibleQuote = bibleQuote || diaryData.bible_quote;
  const finalCollectId = collectId ?? diaryData.collect_id ?? null;

  const rawCollectId = collectId ?? diaryData.collect_id ?? null;
  const collectIdOrNull =
    rawCollectId === undefined || rawCollectId === null || Number(rawCollectId) <= 0
      ? null
      : Number(rawCollectId);

  console.log("處理後的資料:", {
    firebaseUid,
    finalDiaryDate,
    finalDiaryTitle,
    finalDiaryContent,
  });

  // 驗證必填欄位
  if (!firebaseUid) throw new Error("缺少使用者 ID");
  if (!finalDiaryTitle || !finalDiaryContent) {
    throw new Error("diary_title 和 diary_content 為必填欄位");
  }

  // ✅ firebase uid -> userID（流水號）
  const dbUserID = await getUserIDByFirebaseUid(firebaseUid);

  const sql = `
    INSERT INTO diary (
      "user_id",
      diary_date,
      collect_id,
      diary_title,
      diary_content,
      bible_quote,
      tags,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    RETURNING *
  `;

  const params = [
  dbUserID,
  finalDiaryDate,
  collectIdOrNull,
  finalDiaryTitle,
  finalDiaryContent,
  finalBibleQuote || null,
  tags ? JSON.stringify(tags) : null,
];

  console.log("SQL 參數:", params);

  try {
    const result = await pool.query(sql, params);
    console.log("✅ [createDiary] 建立成功:", result.rows[0]);
    return result.rows[0];
  } catch (error) {
    console.error("❌ [createDiary] SQL 執行失敗");
    console.error("錯誤:", error.message);
    throw error;
  }
}

/**
 * 取得使用者的所有日記（只能看自己的）
 * userId 參數：firebase uid
 */
async function getUserDiaries(userId, options = {}) {
  const { limit = 30, offset = 0, startDate, endDate } = options;

  const dbUserID = await getUserIDByFirebaseUid(userId);

  let sql = `
    SELECT *
    FROM diary
    WHERE "user_id" = $1
  `;

  const params = [dbUserID];
  let paramCount = 1;

  if (startDate) {
    paramCount++;
    sql += ` AND diary_date >= $${paramCount}`;
    params.push(startDate);
  }

  if (endDate) {
    paramCount++;
    sql += ` AND diary_date <= $${paramCount}`;
    params.push(endDate);
  }

  sql += ` ORDER BY diary_date DESC, created_at DESC`;

  paramCount++;
  sql += ` LIMIT $${paramCount}`;
  params.push(limit);

  paramCount++;
  sql += ` OFFSET $${paramCount}`;
  params.push(offset);

  const result = await pool.query(sql, params);
  return result.rows;
}

/**
 * 根據 ID 取得日記（必須是自己的）
 * userId 參數：firebase uid
 */
async function getDiaryById(diaryId, userId) {
  const dbUserID = await getUserIDByFirebaseUid(userId);

  const result = await pool.query(
    `SELECT * FROM diary
     WHERE diary_id = $1 AND "user_id" = $2`,
    [diaryId, dbUserID]
  );
  return result.rows[0] || null;
}

/**
 * 根據日期取得日記（只看自己的）
 * userId 參數：firebase uid
 */
async function getDiaryByDate(userId, date) {
  const dbUserID = await getUserIDByFirebaseUid(userId);

  const result = await pool.query(
    `SELECT * FROM diary
     WHERE "user_id" = $1 AND diary_date = $2
     ORDER BY created_at DESC`,
    [dbUserID, date]
  );
  return result.rows;
}

/**
 * 更新日記（必須是自己的）
 * userId 參數：firebase uid
 */
async function updateDiary(diaryId, userId, updates) {
  const dbUserID = await getUserIDByFirebaseUid(userId);

  const diaryDate = updates.diaryDate ?? updates.diary_date;
  const diaryTitle = updates.diaryTitle ?? updates.diary_title;
  const diaryContent = updates.diaryContent ?? updates.diary_content;
  const bibleQuote = updates.bibleQuote ?? updates.bible_quote;
  const tags = updates.tags;

  const fields = [];
  const values = [];
  let paramCount = 1;

  if (diaryDate !== undefined) {
    fields.push(`diary_date = $${paramCount}`);
    values.push(diaryDate);
    paramCount++;
  }

  if (diaryTitle !== undefined) {
    fields.push(`diary_title = $${paramCount}`);
    values.push(diaryTitle);
    paramCount++;
  }

  if (diaryContent !== undefined) {
    fields.push(`diary_content = $${paramCount}`);
    values.push(diaryContent);
    paramCount++;
  }

  if (bibleQuote !== undefined) {
    fields.push(`bible_quote = $${paramCount}`);
    values.push(bibleQuote);
    paramCount++;
  }

  if (tags !== undefined) {
    fields.push(`tags = $${paramCount}`);
    values.push(tags ? JSON.stringify(tags) : null);
    paramCount++;
  }

  if (fields.length === 0) throw new Error("沒有要更新的欄位");

  // fields.push(`updated_at = NOW()`);

  // WHERE 參數
  values.push(diaryId, dbUserID);

  const sql = `
    UPDATE diary
    SET ${fields.join(", ")}
    WHERE diary_id = $${paramCount} AND "user_id" = $${paramCount + 1}
    RETURNING *
  `;

  const result = await pool.query(sql, values);
  return result.rows[0] || null;
}

/**
 * 刪除日記（必須是自己的）
 * userId 參數：firebase uid
 */
async function deleteDiary(diaryId, userId) {
  const dbUserID = await getUserIDByFirebaseUid(userId);

  const result = await pool.query(
    `DELETE FROM diary
     WHERE diary_id = $1 AND "user_id" = $2
     RETURNING diary_id`,
    [diaryId, dbUserID]
  );
  return result.rows[0] || null;
}

/**
 * 取得使用者的日記總數
 * userId 參數：firebase uid
 */
async function getDiaryCount(userId) {
  const dbUserID = await getUserIDByFirebaseUid(userId);

  const result = await pool.query(
    `SELECT COUNT(*) as count FROM diary WHERE "user_id" = $1`,
    [dbUserID]
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * 搜尋日記（只搜尋自己的）
 * userId 參數：firebase uid
 */
async function searchDiaries(userId, keyword, options = {}) {
  const dbUserID = await getUserIDByFirebaseUid(userId);
  const { limit = 30, offset = 0 } = options;

  const sql = `
    SELECT *
    FROM diary
    WHERE "user_id" = $1
    AND (
      diary_title ILIKE $2
      OR diary_content ILIKE $2
      OR bible_quote ILIKE $2
    )
    ORDER BY diary_date DESC, created_at DESC
    LIMIT $3 OFFSET $4
  `;

  const result = await pool.query(sql, [
    dbUserID,
    `%${keyword}%`,
    limit,
    offset,
  ]);

  return result.rows;
}

module.exports = {
  createDiary,
  getUserDiaries,
  getDiaryById,
  getDiaryByDate,
  updateDiary,
  deleteDiary,
  getDiaryCount,
  searchDiaries,
};