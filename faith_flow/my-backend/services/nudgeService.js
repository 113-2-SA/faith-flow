// ==================== services/nudgeService.js ====================
// 禱告回顧光點（Nudge）服務
//
// API 行為：
//   getPendingNudge  — 取得最舊一筆尚未顯示的 nudge（含完整回顧資料）
//   markShown        — 記錄 nudge 顯示時間
//   recordAction     — 記錄使用者行動（dismissed / conversation_started）
//   submitFeedback   — 儲存使用者對本次回顧的評分

const pool = require('../config/database');

/**
 * 取得使用者最舊一筆待顯示的 nudge（shown_at IS NULL）
 * 回傳前端顯示光點卡片所需的完整資料
 *
 * @param {number} userId
 * @returns {object|null}
 */
async function getPendingNudge(userId) {
  // 找最早建立、尚未顯示的 nudge
  const nudgeRes = await pool.query(
    `SELECT n.nudge_id, n.cluster_id, n.created_at,
            c.theme, c.diary_ids, c.emotion_trend,
            c.ai_insight, c.should_ask_question, c.question
     FROM prayer_nudges n
     JOIN prayer_clusters c ON c.cluster_id = n.cluster_id
     WHERE n.user_id = $1
       AND n.shown_at IS NULL
       AND n.user_action IS NULL
     ORDER BY n.created_at ASC
     LIMIT 1`,
    [userId]
  );

  if (nudgeRes.rowCount === 0) return null;

  const nudge = nudgeRes.rows[0];

  // 取出這組日記的摘要資料（供前端時間軸使用）
  const diaryRes = await pool.query(
    `SELECT diary_id, diary_date, diary_title,
            emotion_label, emotion_score
     FROM diary
     WHERE diary_id = ANY($1)
       AND user_id = $2
     ORDER BY diary_date ASC`,
    [nudge.diary_ids, userId]
  );

  // 計算整體情緒分數（最新一篇，作為光點亮度依據）
  const entries = diaryRes.rows;
  const latestEntry = entries[entries.length - 1];
  const overallEmotionScore = latestEntry?.emotion_score ?? 0.5;

  return {
    nudge_id: nudge.nudge_id,
    cluster_id: nudge.cluster_id,
    theme: nudge.theme,
    emotion_trend: nudge.emotion_trend,
    ai_insight: nudge.ai_insight,
    should_ask_question: nudge.should_ask_question,
    question: nudge.question,
    overall_emotion_score: overallEmotionScore, // 0~1，前端決定光點亮暗
    past_entries: entries.map(d => ({
      diary_id: d.diary_id,
      diary_date: d.diary_date,
      diary_title: d.diary_title,
      emotion_label: d.emotion_label,
      emotion_score: d.emotion_score
    }))
  };
}

/**
 * 記錄 nudge 已顯示給使用者（前端進入光點動畫後呼叫）
 *
 * @param {number} nudgeId
 * @param {number} userId
 */
async function markShown(nudgeId, userId) {
  await pool.query(
    `UPDATE prayer_nudges
     SET shown_at = NOW()
     WHERE nudge_id = $1 AND user_id = $2`,
    [nudgeId, userId]
  );
}

/**
 * 記錄使用者行動
 *
 * @param {number} nudgeId
 * @param {number} userId
 * @param {'dismissed'|'conversation_started'} action
 */
async function recordAction(nudgeId, userId, action) {
  const validActions = ['dismissed', 'conversation_started'];
  if (!validActions.includes(action)) {
    throw new Error(`無效的 action：${action}`);
  }

  const conversationStarted = action === 'conversation_started';

  await pool.query(
    `UPDATE prayer_nudges
     SET user_action = $1,
         conversation_started = $2
     WHERE nudge_id = $3 AND user_id = $4`,
    [action, conversationStarted, nudgeId, userId]
  );
}

/**
 * 儲存使用者對回顧的反饋評分
 *
 * @param {number} nudgeId
 * @param {number} rating  1=😞 2=😐 3=😊
 * @param {string|null} reason
 */
async function submitFeedback(nudgeId, rating, reason = null) {
  await pool.query(
    `INSERT INTO nudge_feedback (nudge_id, rating, reason, created_at)
     VALUES ($1, $2, $3, NOW())`,
    [nudgeId, rating, reason]
  );
}

module.exports = {
  getPendingNudge,
  markShown,
  recordAction,
  submitFeedback
};
