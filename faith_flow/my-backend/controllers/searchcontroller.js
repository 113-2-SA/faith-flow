// controllers/searchController.js
const searchService = require('../services/searchservice');

// 搜尋日記
exports.searchDiary = async (req, res) => {
  try {
    const userId = req.userId; // ⭐ 從 attachUserId middleware 取得
    const { keyword, tags, startDate, endDate, page = 1, limit = 20 } = req.query;

    const result = await searchService.searchDiary({
      userId,  // 這是你系統內的 int userID
      keyword,
      tags: tags ? tags.split(',') : [],
      startDate,
      endDate,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      ok: true,
      data: result.diaries,
      pagination: {
        total: result.total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    console.error('[searchDiary] 錯誤:', error);
    res.status(500).json({
      ok: false,
      error: '搜尋日記失敗',
      detail: error.message
    });
  }
};

// 搜尋社群貼文
exports.searchPosts = async (req, res) => {
  try {
    // 這個可能不需要 userId (公開搜尋)
    // 但如果要知道是誰在搜尋,可以用 req.user?.uid (Firebase UID)
    const { keyword, tags, authorId, sortBy = 'relevance', page = 1, limit = 20 } = req.query;

    const result = await searchService.searchPosts({
      keyword,
      tags: tags ? tags.split(',') : [],
      authorId,
      sortBy,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      ok: true,
      data: result.posts,
      pagination: {
        total: result.total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    console.error('[searchPosts] 錯誤:', error);
    res.status(500).json({
      ok: false,
      error: '搜尋貼文失敗',
      detail: error.message
    });
  }
};

// 搜尋對話紀錄
exports.searchMessages = async (req, res) => {
  try {
    const userId = req.userId; // ⭐ 從 attachUserId middleware 取得
    const { keyword, chatId, startDate, endDate, page = 1, limit = 50 } = req.query;

    const result = await searchService.searchMessages({
      userId,
      keyword,
      chatId,
      startDate,
      endDate,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      ok: true,
      data: result.messages,
      pagination: {
        total: result.total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    console.error('[searchMessages] 錯誤:', error);
    res.status(500).json({
      ok: false,
      error: '搜尋訊息失敗',
      detail: error.message
    });
  }
};