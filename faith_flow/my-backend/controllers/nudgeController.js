// ==================== controllers/nudgeController.js ====================
const nudgeService = require('../services/nudgeService');

/**
 * GET /api/nudge/pending
 * 前端在首頁停留 4 秒後呼叫，取得最舊一筆待顯示的光點回顧
 *
 * 回傳：
 *   { ok: true, data: null }           → 沒有待顯示的 nudge
 *   { ok: true, data: { nudge_id, theme, emotion_trend, ai_insight,
 *                        should_ask_question, question,
 *                        overall_emotion_score, past_entries[] } }
 */
exports.getPending = async (req, res) => {
  try {
    const userId = req.userId;
    const nudge = await nudgeService.getPendingNudge(userId);

    res.json({ ok: true, data: nudge }); // data 為 null 代表目前沒有待顯示的回顧
  } catch (error) {
    console.error('[nudge] getPending 錯誤:', error);
    res.status(500).json({ ok: false, error: '取得回顧失敗', detail: error.message });
  }
};

/**
 * PATCH /api/nudge/:id/shown
 * 光點動畫開始播放時呼叫，標記此 nudge 已顯示
 */
exports.markShown = async (req, res) => {
  try {
    const userId = req.userId;
    const nudgeId = parseInt(req.params.id);

    await nudgeService.markShown(nudgeId, userId);
    res.json({ ok: true });
  } catch (error) {
    console.error('[nudge] markShown 錯誤:', error);
    res.status(500).json({ ok: false, error: '更新失敗', detail: error.message });
  }
};

/**
 * PATCH /api/nudge/:id/action
 * 使用者選擇行動後呼叫
 * Body: { action: 'dismissed' | 'conversation_started' }
 */
exports.recordAction = async (req, res) => {
  try {
    const userId = req.userId;
    const nudgeId = parseInt(req.params.id);
    const { action } = req.body;

    if (!action) {
      return res.status(400).json({ ok: false, error: '缺少 action 欄位' });
    }

    await nudgeService.recordAction(nudgeId, userId, action);
    res.json({ ok: true });
  } catch (error) {
    console.error('[nudge] recordAction 錯誤:', error);
    res.status(500).json({ ok: false, error: '記錄行動失敗', detail: error.message });
  }
};

/**
 * POST /api/nudge/:id/feedback
 * 使用者提交回顧評分
 * Body: { rating: 1|2|3, reason?: string }
 *   1 = 😞（沒幫助）  2 = 😐（普通）  3 = 😊（有幫助）
 */
exports.submitFeedback = async (req, res) => {
  try {
    const nudgeId = parseInt(req.params.id);
    const { rating, reason } = req.body;

    if (!rating || ![1, 2, 3].includes(Number(rating))) {
      return res.status(400).json({ ok: false, error: 'rating 必須為 1、2 或 3' });
    }

    await nudgeService.submitFeedback(nudgeId, Number(rating), reason || null);
    res.json({ ok: true });
  } catch (error) {
    console.error('[nudge] submitFeedback 錯誤:', error);
    res.status(500).json({ ok: false, error: '提交評分失敗', detail: error.message });
  }
};
