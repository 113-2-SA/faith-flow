// ==================== services/diaryservice.js ====================
const pool = require("../config/database");
const { getEmbedding } = require("./embeddingService");

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
  } = diaryData;

  // 支援 snake_case
  const dbUserID = userId; // ⭐ controller 傳進來的就是 int
  const finalDiaryDate =
    diaryDate || diaryData.diary_date || new Date().toISOString().split("T")[0];
  const finalDiaryTitle = diaryTitle || diaryData.diary_title;
  const finalDiaryContent = diaryContent || diaryData.diary_content;
  const finalBibleQuote = bibleQuote || diaryData.bible_quote;

  console.log("處理後的資料:", {
    // firebaseUid,
    finalDiaryDate,
    finalDiaryTitle,
    finalDiaryContent,
  });

  // 驗證必填欄位
  if (!dbUserID) throw new Error("缺少使用者 ID");
  if (!finalDiaryTitle || !finalDiaryContent) {
    throw new Error("diary_title 和 diary_content 為必填欄位");
  }

  // ✅ firebase uid -> userID（流水號）
  // const dbUserID = await getUserIDByFirebaseUid(firebaseUid);

  const sql = `
    INSERT INTO diary (
      "user_id",
      diary_date,
      diary_title,
      diary_content,
      bible_quote,
      tags,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING *
  `;

  const params = [
  dbUserID,
  finalDiaryDate,
  finalDiaryTitle,
  finalDiaryContent,
  finalBibleQuote || null,
  tags ? JSON.stringify(tags) : null,
];

  console.log("SQL 參數:", params);

  try {
    const result = await pool.query(sql, params);
    console.log("✅ [createDiary] 建立成功:", result.rows[0]);

    // ⭐ 自動產生 embedding（非同步，不阻塞回傳）
    const newDiary = result.rows[0];
    const textToEmbed = [finalDiaryTitle, finalDiaryContent].filter(Boolean).join(" ");
    getEmbedding(textToEmbed)
      .then(embedding => {
        if (embedding) {
          pool.query(
            'UPDATE diary SET embedding = $1 WHERE diary_id = $2',
            [JSON.stringify(embedding), newDiary.diary_id]
          ).then(() => console.log("✅ [createDiary] embedding 已更新"))
           .catch(err => console.warn("⚠️ [createDiary] embedding 寫入失敗:", err.message));
        }
      })
      .catch(err => console.warn("⚠️ [createDiary] embedding 生成失敗:", err.message));

    return newDiary;
  } catch (error) {
    console.error("❌ [createDiary] SQL 執行失敗");
    console.error("錯誤:", error.message);
    throw error;
  }
}

/**
 * 取得使用者的日記（支援多種篩選）
 */
async function getUserDiaries(userId, options = {}) {
  const {
    limit = 30,
    offset = 0,
    startDate,      // 開始日期 (YYYY-MM-DD) //開始與結束用於提供資訊給LLM整理時篩選
    endDate,        // 結束日期 (YYYY-MM-DD)
    date,           // 特定日期 (YYYY-MM-DD) - 優先級最高
    year,           // 年份 (YYYY)
    month,          // 月份 (1-12)
    keyword,        // 搜尋關鍵字
    sortBy = 'date', // 排序方式: 'date' 或 'created'
    sortOrder = 'DESC' // 排序順序: 'ASC' 或 'DESC'
  } = options;

  let sql = `
    SELECT
      diary_id,
      diary_date,
      diary_title,
      diary_content,
      bible_quote,
      tags,
      created_at
    FROM diary
    WHERE user_id = $1
  `;

  const params = [userId];
  let paramCount = 1;

  // ⭐ 篩選 1: 特定日期（優先級最高）
  if (date) {
    paramCount++;
    sql += ` AND diary_date = $${paramCount}`;
    params.push(date);
    console.log(`[篩選] 特定日期: ${date}`);
  }
  // ⭐ 篩選 2: 日期範圍
  else {
    if (startDate) {
      paramCount++;
      sql += ` AND diary_date >= $${paramCount}`;
      params.push(startDate);
      console.log(`[篩選] 開始日期: ${startDate}`);
    }

    if (endDate) {
      paramCount++;
      sql += ` AND diary_date <= $${paramCount}`;
      params.push(endDate);
      console.log(`[篩選] 結束日期: ${endDate}`);
    }
  }

  // ⭐ 篩選 3: 年份
  if (year && !date && !startDate && !endDate) {
    paramCount++;
    sql += ` AND EXTRACT(YEAR FROM diary_date) = $${paramCount}`;
    params.push(year);
    console.log(`[篩選] 年份: ${year}`);
  }

  // ⭐ 篩選 4: 月份（需要配合年份）
  if (month && year) {
    paramCount++;
    sql += ` AND EXTRACT(MONTH FROM diary_date) = $${paramCount}`;
    params.push(month);
    console.log(`[篩選] 月份: ${year}-${month}`);
  }

  // ⭐ 篩選 5: 關鍵字搜尋（標題、內容、經文、標籤）
  if (keyword) {
    paramCount++;
    sql += ` AND (
      diary_title ILIKE $${paramCount}
      OR diary_content ILIKE $${paramCount}
      OR bible_quote ILIKE $${paramCount}
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) AS _tag
        WHERE _tag ILIKE $${paramCount}
      )
    )`;
    params.push(`%${keyword}%`);
    console.log(`[篩選] 關鍵字: ${keyword}`);
  }

  // ⭐ 排序
  const validSortBy = ['date', 'created'];
  const validSortOrder = ['ASC', 'DESC'];
  
  const actualSortBy = validSortBy.includes(sortBy) ? sortBy : 'date';
  const actualSortOrder = validSortOrder.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

  if (actualSortBy === 'date') {
    sql += ` ORDER BY diary_date ${actualSortOrder}, created_at ${actualSortOrder}`;
  } else {
    sql += ` ORDER BY created_at ${actualSortOrder}`;
  }

  // 分頁
  paramCount++;
  sql += ` LIMIT $${paramCount}`;
  params.push(limit);

  paramCount++;
  sql += ` OFFSET $${paramCount}`;
  params.push(offset);

  console.log('[SQL]', sql);
  console.log('[參數]', params);

  const result = await pool.query(sql, params);
  return result.rows;
}

/**
 * 根據 ID 取得日記（必須是自己的）
 * userId 參數：firebase uid
 */
async function getDiaryById(diaryId, userId) {
  const result = await pool.query(
    `SELECT * FROM diary
     WHERE diary_id = $1 AND "user_id" = $2`,
    [diaryId, userId]
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
  const dbUserID = userId; // userId 從 attachUserId 中間件取得，已是 int

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
  const updated = result.rows[0] || null;

  // ⭐ 內容有更新時，重新產生 embedding
  if (updated && (diaryTitle !== undefined || diaryContent !== undefined)) {
    const title = diaryTitle || updated.diary_title || "";
    const content2 = diaryContent || updated.diary_content || "";
    const textToEmbed = [title, content2].filter(Boolean).join(" ");
    getEmbedding(textToEmbed)
      .then(embedding => {
        if (embedding) {
          pool.query(
            'UPDATE diary SET embedding = $1 WHERE diary_id = $2',
            [JSON.stringify(embedding), updated.diary_id]
          ).then(() => console.log("✅ [updateDiary] embedding 已更新"))
           .catch(err => console.warn("⚠️ [updateDiary] embedding 寫入失敗:", err.message));
        }
      })
      .catch(err => console.warn("⚠️ [updateDiary] embedding 生成失敗:", err.message));
  }

  return updated;
}

/**
 * 刪除日記（必須是自己的）
 * userId 參數：firebase uid
 */
async function deleteDiary(diaryId, userId) {
  // const dbUserID = await getUserIDByFirebaseUid(userId);

  const result = await pool.query(
    `DELETE FROM diary
     WHERE diary_id = $1 AND "user_id" = $2
     RETURNING diary_id`,
    [diaryId, userId]
  );
  return result.rows[0] || null;
}

/**
 * 取得使用者的日記總數（套用與 getUserDiaries 相同的篩選條件）
 */
async function getDiaryCount(userId, options = {}) {
  const {
    startDate,
    endDate,
    date,
    year,
    month,
    keyword,
  } = options;

  let sql = `SELECT COUNT(*) as count FROM diary WHERE user_id = $1`;
  const params = [userId];
  let paramCount = 1;

  if (date) {
    paramCount++;
    sql += ` AND diary_date = $${paramCount}`;
    params.push(date);
  } else {
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
  }

  if (year && !date && !startDate && !endDate) {
    paramCount++;
    sql += ` AND EXTRACT(YEAR FROM diary_date) = $${paramCount}`;
    params.push(year);
  }

  if (month && year) {
    paramCount++;
    sql += ` AND EXTRACT(MONTH FROM diary_date) = $${paramCount}`;
    params.push(month);
  }

  if (keyword) {
    paramCount++;
    sql += ` AND (
      diary_title ILIKE $${paramCount}
      OR diary_content ILIKE $${paramCount}
      OR bible_quote ILIKE $${paramCount}
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) AS _tag
        WHERE _tag ILIKE $${paramCount}
      )
    )`;
    params.push(`%${keyword}%`);
  }

  const result = await pool.query(sql, params);
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

/**
 * 取得日記統計（年月分布）
 */
async function getDiaryStats(userId) {
  const sql = `
    SELECT 
      EXTRACT(YEAR FROM diary_date) as year,
      EXTRACT(MONTH FROM diary_date) as month,
      COUNT(*) as count
    FROM diary
    WHERE user_id = $1
    GROUP BY year, month
    ORDER BY year DESC, month DESC
  `;

  const result = await pool.query(sql, [userId]);
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
  getDiaryStats,
};