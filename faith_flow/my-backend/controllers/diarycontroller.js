// ==================== controllers/diarycontroller.js ====================
const diaryService = require("../services/diaryservice");
const prayerService = require("../services/prayservice");
const { runAIPrayerPipeline } = require("../services/aiPrayerService");
const pool = require("../config/database");
console.log("[diarycontroller] hit /api/diary");

/**
 * 建立新日記
 * POST /api/diary
 */
exports.createDiary = async (req, res) => {
  try {
    console.log('📥 收到建立日記請求');
    console.log('📦 Request body:', req.body);
    
    const userId = req.userId; // ⭐ 這裡從 attachUserId 中間件取得 userId
    console.log('👤 使用者 ID:', userId);
    
    const {
      diary_date,
      diary_title,
      diary_content,
      bible_quote,
      tags
    } = req.body;

    const diaryTitle = diary_title || req.body.diaryTitle;
    const diaryContent = diary_content || req.body.diaryContent;

    if (!diaryTitle || !diaryContent) {
      return res.status(400).json({
        ok: false,
        error: "標題和內容為必填欄位"
      });
    }

    console.log('🔄 準備寫入資料庫...');

    const diary = await diaryService.createDiary({
      userId: userId,
      diaryDate: diary_date || req.body.diaryDate,
      diaryTitle: diaryTitle,
      diaryContent: diaryContent,
      bibleQuote: bible_quote || req.body.bibleQuote,
      tags: tags,
    });

    console.log('✅ 日記建立成功:', diary);

    // ⭐ 先回傳成功給前端，再非同步執行 AI 禱告流程（不阻塞）
    res.status(201).json({
      ok: true,
      message: "日記建立成功",
      data: diary
    });

    // [AI 禱告歷程] 非同步觸發，不等待結果
    runAIPrayerPipeline(diary.diary_id, diary.diary_content, diary.user_id, diary.diary_title, diary.tags ?? []);
  } catch (error) {
    console.error('❌ [createDiary] 錯誤:', error);
    res.status(500).json({
      ok: false,
      error: "建立日記失敗",
      detail: error.message
    });
  }
};

/**
 * ⭐ 取得使用者的日記列表（支援多種篩選）
 * GET /api/diary
 * GET /api/diary?date=2025-12-26
 * GET /api/diary?startDate=2025-12-01&endDate=2025-12-31
 * GET /api/diary?collectId=1
 * GET /api/diary?year=2025&month=12
 * GET /api/diary?keyword=主日
 */


exports.getDiaries = async (req, res) => {
  try {
    const userId = req.userId; // ⭐ 這裡從 attachUserId 中間件取得 userId
  
    // 從 query string 取得所有篩選參數
    const {
      limit = 30,
      offset = 0,
      date,           // 特定日期 (YYYY-MM-DD)
      startDate,      // 開始日期 (YYYY-MM-DD)
      endDate,        // 結束日期 (YYYY-MM-DD)
      year,           // 年份 (YYYY)
      month,          // 月份 (1-12)
      keyword,        // 搜尋關鍵字
      sortBy,         // 排序方式 (date/created)
      sortOrder       // 排序順序 (ASC/DESC)
    } = req.query;

    console.log('📥 [getDiaries] 篩選參數:', {
      date,
      startDate,
      endDate,
      year,
      month,
      keyword,
      sortBy,
      sortOrder
    });

    // 組合篩選選項
    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      date,
      startDate,
      endDate,
      year: year ? parseInt(year) : undefined,
      month: month ? parseInt(month) : undefined,
      keyword,
      sortBy,
      sortOrder
    };

    // 取得日記列表
    const diaries = await diaryService.getUserDiaries(userId, options);

    // 取得總數（使用相同的篩選條件）
    const totalCount = await diaryService.getDiaryCount(userId, options);

    console.log(`✅ [getDiaries] 取得 ${diaries.length} 篇日記，總共 ${totalCount} 篇`);

    res.json({
      ok: true,
      data: {
        items: diaries,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount,
          hasMore: parseInt(offset) + diaries.length < totalCount
        },
        filters: {
          date,
          startDate,
          endDate,
          year: year ? parseInt(year) : null,
          month: month ? parseInt(month) : null,
          keyword
        }
      }
    });
  } catch (error) {
    console.error('[getDiaries] 錯誤:', error);
    res.status(500).json({ 
      ok: false, 
      error: "取得日記失敗",
      detail: error.message 
    });
  }
};

/**
 * 取得特定日記
 * GET /api/diary/:id
 */
exports.getDiaryById = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    console.log(`📥 [getDiaryById] 取得日記 ID: ${id}, 使用者: ${userId}`);

    // 檢查 service 是否有這個函式
    if (typeof diaryService.getDiaryById === "function") {
      const diary = await diaryService.getDiaryById(id, userId);
      
      if (!diary) {
        console.log(`❌ [getDiaryById] 找不到日記 ID: ${id}`);
        return res.status(404).json({
          ok: false,
          error: "找不到日記"
        });
      }

      console.log(`✅ [getDiaryById] 成功取得日記`);
      return res.json({ ok: true, data: diary });
    }

    // 如果 service 沒有提供，回傳錯誤
    console.error('❌ [getDiaryById] diaryService 缺少 getDiaryById 方法');
    return res.status(500).json({
      ok: false,
      error: "diaryService 缺少 getDiaryById 方法，請在 services 補上對應函式"
    });
  } catch (error) {
    console.error("[getDiaryById] 錯誤:", error);
    res.status(500).json({ 
      ok: false, 
      error: "取得日記失敗", 
      detail: error.message 
    });
  }
};

/**
 * ⭐ 依日期取得日記（向下相容舊 API）
 * GET /api/diary/date/:date
 * 日期格式：YYYY-MM-DD
 * 
 * 注意：這是為了向下相容，建議新程式碼使用 GET /api/diary?date=YYYY-MM-DD
 */
exports.getDiaryByDate = async (req, res) => {
  try {
    const userId = req.userId;
    const { date } = req.params;
    const { limit = 30, offset = 0 } = req.query;

    console.log(`📅 [getDiaryByDate] 取得 ${date} 的日記（舊 API）`);

    const options = {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      date: date  // ⭐ 使用特定日期篩選
    };

    const diaries = await diaryService.getUserDiaries(userId, options);
    const totalCount = await diaryService.getDiaryCount(userId, options);

    console.log(`✅ [getDiaryByDate] 取得 ${diaries.length} 篇日記`);

    res.json({ 
      ok: true, 
      data: {
        items: diaries,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount
        }
      }
    });
  } catch (error) {
    console.error("[getDiaryByDate] 錯誤:", error);
    res.status(500).json({ 
      ok: false, 
      error: "取得日記失敗", 
      detail: error.message 
    });
  }
};

/**
 * 更新日記
 * PUT /api/diary/:id
 */
exports.updateDiary = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const updates = req.body;

    console.log(`📝 [updateDiary] 更新日記 ID: ${id}`);

    const updatedDiary = await diaryService.updateDiary(id, userId, updates);

    if (!updatedDiary) {
      console.log(`❌ [updateDiary] 找不到日記或無權限`);
      return res.status(404).json({ 
        ok: false, 
        error: "找不到日記或無權限修改" 
      });
    }

    console.log(`✅ [updateDiary] 更新成功`);
    res.json({ ok: true, message: "日記更新成功", data: updatedDiary });
  } catch (error) {
    console.error('[updateDiary] 錯誤:', error);
    res.status(500).json({ 
      ok: false, 
      error: "更新日記失敗",
      detail: error.message 
    });
  }
};

/**
 * 刪除日記
 * DELETE /api/diary/:id
 */
exports.deleteDiary = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    console.log(`🗑️ [deleteDiary] 刪除日記 ID: ${id}`);

    const deleted = await diaryService.deleteDiary(id, userId);

    if (!deleted) {
      console.log(`❌ [deleteDiary] 找不到日記或無權限`);
      return res.status(404).json({ 
        ok: false, 
        error: "找不到日記或無權限刪除" 
      });
    }

    console.log(`✅ [deleteDiary] 刪除成功`);
    res.json({ ok: true, message: "日記刪除成功" });
  } catch (error) {
    console.error('[deleteDiary] 錯誤:', error);
    res.status(500).json({ 
      ok: false, 
      error: "刪除日記失敗",
      detail: error.message 
    });
  }
};

/**
 * 搜尋日記
 * GET /api/diary/search?q=關鍵字
 */
exports.searchDiaries = async (req, res) => {
  try {
    const userId = req.userId;
    const { q: keyword, limit = 30, offset = 0 } = req.query;

    if (!keyword) {
      return res.status(400).json({ 
        ok: false, 
        error: "請提供搜尋關鍵字" 
      });
    }

    console.log(`🔍 [searchDiaries] 搜尋關鍵字: ${keyword}`);

    const diaries = await diaryService.searchDiaries(userId, keyword, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    console.log(`✅ [searchDiaries] 找到 ${diaries.length} 篇日記`);

    res.json({ ok: true, data: diaries });
  } catch (error) {
    console.error('[searchDiaries] 錯誤:', error);
    res.status(500).json({ 
      ok: false, 
      error: "搜尋失敗",
      detail: error.message 
    });
  }
};

/**
 * ⭐ 取得使用者的日記本列表
 * GET /api/diary/collections
 */
// exports.getCollections = async (req, res) => {
//   try {
//     const userId = req.userId;

//     console.log(`📚 [getCollections] 取得日記本列表`);

//     const collections = await diaryService.getUserCollections(userId);

//     console.log(`✅ [getCollections] 找到 ${collections.length} 個日記本`);

//     res.json({
//       ok: true,
//       data: collections
//     });
//   } catch (error) {
//     console.error('[getCollections] 錯誤:', error);
//     res.status(500).json({ 
//       ok: false, 
//       error: "取得日記本失敗",
//       detail: error.message 
//     });
//   }
// };

/**
 * ⭐ 取得日記統計（年月分布）
 * GET /api/diary/stats
 */
exports.getStats = async (req, res) => {
  try {
    const userId = req.userId;

    console.log(`📊 [getStats] 取得日記統計`);

    const stats = await diaryService.getDiaryStats(userId);

    console.log(`✅ [getStats] 取得 ${stats.length} 筆統計資料`);

    res.json({
      ok: true,
      data: stats
    });
  } catch (error) {
    console.error('[getStats] 錯誤:', error);
    res.status(500).json({ 
      ok: false, 
      error: "取得統計失敗",
      detail: error.message 
    });
  }
};

/**
 * ⭐ 從祈禱轉錄建立日記
 * POST /api/diary/from-prayer
 */
exports.createFromPrayer = async (req, res) => {
  try {
    console.log('🙏 [createFromPrayer] 收到祈禱轉日記請求');
    
    const userId = req.userId;
    const { transcript, latitude, longitude } = req.body;

    console.log('👤 使用者 ID:', userId);
    console.log('📝 祈禱文字長度:', transcript?.length);
    console.log('📍 位置:', latitude != null ? `${latitude}, ${longitude}` : '無');

    if (!transcript || transcript.trim().length === 0) {
      console.log('❌ [createFromPrayer] 祈禱內容為空');
      return res.status(400).json({
        ok: false,
        error: '祈禱內容不能為空'
      });
    }

    // 1. 轉換語音為日記（AI 生成標題/標籤/聖經福音）
    const diary = await prayerService.convertPrayerToDiary(
      userId,
      transcript.trim()
    );

    // 2. 若有座標，將位置寫入 prayer_locations（關聯到剛建立的日記）
    if (latitude != null && longitude != null) {
      await pool.query(
        `INSERT INTO prayer_locations (diary_id, latitude, longitude)
         VALUES ($1, $2, $3)`,
        [diary.diary_id, parseFloat(latitude), parseFloat(longitude)]
      );
      console.log('📍 [createFromPrayer] 禱告位置已記錄 diary_id:', diary.diary_id);
    }

    console.log('✅ [createFromPrayer] 祈禱日記建立成功! ID:', diary.diary_id);

    // ⭐ 先回傳成功給前端，再非同步執行 AI 禱告流程（不阻塞）
    res.status(201).json({
      ok: true,
      message: '✨ 祈禱已轉換為日記！', // 這個會在前端顯示
      notification: {
        type: 'success',
        title: '祈禱已記錄',
        body: `標題：${diary.diary_title}`
      },
      data: diary
    });

    // [AI 禱告歷程] 非同步觸發，不等待結果
    runAIPrayerPipeline(diary.diary_id, diary.diary_content, diary.user_id, diary.diary_title, diary.tags ?? []);
  } catch (error) {
    console.error('❌ [createFromPrayer] 錯誤:', error);
    res.status(500).json({
      ok: false,
      error: '轉換失敗',
      detail: error.message
    });
  }
};

/**
 * ⭐ 預覽祈禱轉日記（不儲存）
 * POST /api/diary/preview-prayer
 */
exports.previewPrayer = async (req, res) => {
  try {
    console.log('👁️ [previewPrayer] 收到預覽請求');
    
    const { transcript } = req.body;

    if (!transcript || transcript.trim().length === 0) {
      return res.status(400).json({ 
        ok: false,
        error: '需要提供祈禱內容' 
      });
    }

    const preview = await prayerService.previewDiary(transcript.trim());

    console.log('✅ [previewPrayer] 預覽生成成功');

    res.json({
      ok: true,
      data: preview
    });
  } catch (error) {
    console.error('❌ [previewPrayer] 錯誤:', error);
    res.status(500).json({
      ok: false,
      error: '預覽生成失敗',
      detail: error.message
    });
  }
};

/**
 * 取得使用者的禱告地點（含日記內容）
 * GET /api/diary/prayer-locations
 */
exports.getPrayerLocations = async (req, res) => {
  try {
    const userId = req.userId;

    const result = await pool.query(
      `SELECT
         pl.prayp_id  AS id,
         pl.diary_id,
         pl.latitude::float  AS latitude,
         pl.longitude::float AS longitude,
         pl.created_at,
         d.diary_content AS text,
         d.diary_title   AS title
       FROM prayer_locations pl
       JOIN diary d ON pl.diary_id = d.diary_id
       WHERE d.user_id = $1
       ORDER BY pl.created_at DESC`,
      [userId]
    );

    res.json({ ok: true, data: result.rows });
  } catch (error) {
    console.error('❌ [getPrayerLocations] 錯誤:', error);
    res.status(500).json({ ok: false, error: '取得禱告位置失敗', detail: error.message });
  }
};