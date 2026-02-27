// ==================== controllers/diarycontroller.js ====================
const diaryService = require("../services/diaryservice");

/**
 * 建立新日記
 */
exports.createDiary = async (req, res) => {
  try {
    console.log('📥 收到建立日記請求');
    console.log('📦 Request body:', req.body);
    
    // ⭐ 從 verifyToken middleware 取得使用者 ID
    const userId = req.user.uid;
    console.log('👤 使用者 ID:', userId);
    
    const {
      diary_date,
      diary_title,
      diary_content,
      bible_quote,
      tags,
      collectId
    } = req.body;

    // 驗證必填欄位
    const diaryTitle = diary_title || req.body.diaryTitle;
    const diaryContent = diary_content || req.body.diaryContent;

    if (!diaryTitle || !diaryContent) {
      return res.status(400).json({
        ok: false,
        error: "標題和內容為必填欄位"
      });
    }

    console.log('🔄 準備寫入資料庫...');

    // ⭐ 傳入使用者 ID
    const diary = await diaryService.createDiary({
      userId: userId,  // ⭐ 重要：傳入使用者 ID
      diaryDate: diary_date || req.body.diaryDate,
      diaryTitle: diaryTitle,
      diaryContent: diaryContent,
      bibleQuote: bible_quote || req.body.bibleQuote,
      tags: tags,
      collectId: collectId || req.body.collect_id || 0
    });

    console.log('✅ 日記建立成功:', diary);

    res.status(201).json({
      ok: true,
      message: "日記建立成功",
      data: diary
    });
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
 * 取得使用者的所有日記
 */
exports.getDiaries = async (req, res) => {
  try {
    const userId = req.user.uid;  // ⭐ 從 token 取得
    const { limit = 30, offset = 0, startDate, endDate } = req.query;

    const diaries = await diaryService.getUserDiaries(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      startDate,
      endDate
    });

    const totalCount = await diaryService.getDiaryCount(userId);

    res.json({
      ok: true,
      data: {
        items: diaries,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount,
          hasMore: parseInt(offset) + diaries.length < totalCount
        }
      }
    });
  } catch (error) {
    console.error('[getDiaries] 錯誤:', error);
    res.status(500).json({ ok: false, error: "取得日記失敗" });
  }
};

/**
 * 取得特定日記
 */
/**
 * 取得特定日記
 * GET /api/diary/:id
 */
exports.getDiaryById = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { id } = req.params;

    // 依你現有 service 命名，二選一：
    // 1) 如果你有 diaryService.getDiaryById(userId, id)
    if (typeof diaryService.getDiaryById === "function") {
      const diary = await diaryService.getDiaryById(userId, id);
      return res.json({ ok: true, data: diary });
    }

    // 2) 如果你有 diaryService.getDiary(userId, id) 或類似
    if (typeof diaryService.getDiary === "function") {
      const diary = await diaryService.getDiary(userId, id);
      return res.json({ ok: true, data: diary });
    }

    // 如果 service 沒有提供，直接回明確錯誤，方便你補 service
    return res.status(500).json({
      ok: false,
      error: "diaryService 缺少 getDiaryById/getDiary 方法，請在 services 補上對應函式",
    });
  } catch (error) {
    console.error("[getDiaryById] 錯誤:", error);
    res.status(500).json({ ok: false, error: "取得日記失敗", detail: error.message });
  }
};

/**
 * 依日期取得單日日記
 * GET /api/diary/date/:date
 * date 建議格式：YYYY-MM-DD
 */
exports.getDiaryByDate = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { date } = req.params;
    const { limit = 30, offset = 0 } = req.query;

    const diaries = await diaryService.getUserDiaries(userId, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      startDate: date,
      endDate: date,
    });

    res.json({ ok: true, data: diaries });
  } catch (error) {
    console.error("[getDiaryByDate] 錯誤:", error);
    res.status(500).json({ ok: false, error: "取得日記失敗", detail: error.message });
  }
};

/**
 * 更新日記
 */
exports.updateDiary = async (req, res) => {
  try {
    const userId = req.user.uid;  // ⭐ 確保只能改自己的
    const { id } = req.params;
    const updates = req.body;

    const updatedDiary = await diaryService.updateDiary(id, userId, updates);

    if (!updatedDiary) {
      return res.status(404).json({ ok: false, error: "找不到日記或無權限修改" });
    }

    res.json({ ok: true, message: "日記更新成功", data: updatedDiary });
  } catch (error) {
    console.error('[updateDiary] 錯誤:', error);
    res.status(500).json({ ok: false, error: "更新日記失敗" });
  }
};

/**
 * 刪除日記
 */
exports.deleteDiary = async (req, res) => {
  try {
    const userId = req.user.uid;  // ⭐ 確保只能刪自己的
    const { id } = req.params;

    const deleted = await diaryService.deleteDiary(id, userId);

    if (!deleted) {
      return res.status(404).json({ ok: false, error: "找不到日記或無權限刪除" });
    }

    res.json({ ok: true, message: "日記刪除成功" });
  } catch (error) {
    console.error('[deleteDiary] 錯誤:', error);
    res.status(500).json({ ok: false, error: "刪除日記失敗" });
  }
};

/**
 * 搜尋日記
 */
exports.searchDiaries = async (req, res) => {
  try {
    const userId = req.user.uid;  // ⭐ 只搜尋自己的
    const { q: keyword, limit = 30, offset = 0 } = req.query;

    if (!keyword) {
      return res.status(400).json({ ok: false, error: "請提供搜尋關鍵字" });
    }

    const diaries = await diaryService.searchDiaries(userId, keyword, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({ ok: true, data: diaries });
  } catch (error) {
    console.error('[searchDiaries] 錯誤:', error);
    res.status(500).json({ ok: false, error: "搜尋失敗" });
  }
};