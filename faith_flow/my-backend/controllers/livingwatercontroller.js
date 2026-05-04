// ============================================================
// livingwatercontroller.js
// 活水泉源 — Controller 層
// ============================================================

const { generateLetter, generateImage } = require('../services/livingwaterservice');
const pool = require('../config/database');

// ============================================================
// 工具函式：計算本週的開始日期（週一）
// ============================================================
function getWeekStartDate() {
  const now = new Date();
  const day = now.getDay(); // 0=週日, 1=週一...6=週六
  const diff = day === 0 ? -6 : 1 - day; // 往回推到週一
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ============================================================
// 工具函式：用週數當 seed 隨機抽5題（不重複）
// ============================================================
function pickWeeklyQuestions(questions, weekNumber) {
  const seededRandom = (seed) => {
    const x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
  };

  const indexes = [];
  let seed = weekNumber * 100;
  while (indexes.length < 5) {
    const idx = Math.floor(seededRandom(seed) * questions.length);
    if (!indexes.includes(idx)) indexes.push(idx);
    seed++;
  }
  return indexes;
}

// ============================================================
// GET /api/livingwater/weekly-cards
// 取得本週五張卡（如果 DB 沒有就自動建立）
// ============================================================
const getWeeklyCardsController = async (req, res) => {
  try {
    const weekStartDate = getWeekStartDate();

    // 先查看本週是否已經有卡片
    const existing = await pool.query(
      'SELECT wc.weekly_cards_id, wc.day_no, aq.ai_question_id, aq.question_text, aq.theme, aq.quote, aq.quote_source, aq.image_url FROM weekly_cards wc JOIN ai_questions aq ON wc.ai_question_id = aq.ai_question_id WHERE wc.weekly_start_date = $1 ORDER BY wc.day_no',
      [weekStartDate]
    );

    // 本週已有卡片，直接回傳
    if (existing.rows.length === 5) {
      const cards = existing.rows.map(row => ({
        weekly_card_id: row.weekly_cards_id,
        day: row.day_no,
        id: row.ai_question_id,
        question: row.question_text,
        theme: row.theme,
        quote: row.quote,
        quote_source: row.quote_source,
        image_url: row.image_url,
      }));
      return res.status(200).json({ success: true, data: cards });
    }

    // 本週還沒有卡片，從 ai_questions 抽5題並寫入
    console.log('[活水泉源] 本週卡片不存在，開始抽題...');

    // 計算週數（用來當 seed）
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.floor((now - startOfYear) / (7 * 24 * 60 * 60 * 1000));

    // 取出所有題目
    const allQuestions = await pool.query(
      'SELECT ai_question_id, question_text, theme, quote, quote_source, image_url FROM ai_questions WHERE is_active = true AND is_ready = true ORDER BY ai_question_id'
    );

    if (allQuestions.rows.length < 5) {
      return res.status(500).json({ success: false, message: '題庫題目不足' });
    }

    // 用 seed 抽5題
    const indexes = pickWeeklyQuestions(allQuestions.rows, weekNumber);
    const pickedQuestions = indexes.map(i => allQuestions.rows[i]);

    // 先刪除本週舊資料（避免重複）
    await pool.query(
      'DELETE FROM weekly_cards WHERE weekly_start_date = $1',
      [weekStartDate]
    );

    // 寫入 weekly_cards 表
    const insertedCards = [];
    for (let i = 0; i < pickedQuestions.length; i++) {
      const q = pickedQuestions[i];
      const result = await pool.query(
'INSERT INTO weekly_cards (weekly_start_date, day_no, card_style_id, ai_question_id, created_at) VALUES ($1, $2, 1, $3, NOW()) RETURNING weekly_cards_id',        [weekStartDate, i + 1, q.ai_question_id]
      );
      insertedCards.push({
        weekly_card_id: result.rows[0].weekly_cards_id,
        day: i + 1,
        id: q.ai_question_id,
        question: q.question_text,
        theme: q.theme,
        quote: q.quote,
        quote_source: q.quote_source,
        image_url: q.image_url,
      });
    }

    console.log('[活水泉源] 本週卡片已建立:', insertedCards.length, '張');
    return res.status(200).json({ success: true, data: insertedCards });

  } catch (error) {
    console.error('[活水泉源] getWeeklyCards 錯誤：', error.message);
    return res.status(500).json({ success: false, message: '取得本週題目失敗', error: error.message });
  }
};

// ============================================================
// GET /api/livingwater/daily-card
// 取得今日的卡片（含 image_base64）
// ============================================================
const getDailyCardController = async (req, res) => {
  try {
    const weekStartDate = getWeekStartDate();

    // 今天是第幾天（1=週一 ~ 5=週五）
    const now = new Date();
    const dayOfWeek = now.getDay();
    const dayNo = dayOfWeek === 0 ? 5 : Math.min(dayOfWeek, 5); // 週日算第5天

    const result = await pool.query(
      `SELECT wc.weekly_cards_id, wc.day_no, 
              aq.ai_question_id, aq.question_text, aq.theme, 
              aq.quote, aq.quote_source, aq.image_url, aq.image_prompt
       FROM weekly_cards wc 
       JOIN ai_questions aq ON wc.ai_question_id = aq.ai_question_id
       WHERE wc.weekly_start_date = $1 AND wc.day_no = $2`,
      [weekStartDate, dayNo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '今日卡片不存在，請先呼叫 weekly-cards API' });
    }

    const row = result.rows[0];

    // 讀取 image_base64（從 JSON 題庫暫時補上）
    let image_base64 = null;
    try {
      const questions = require('../scripts/faithflow_questions_with_assets.json');
      const matched = questions.find(q => q.question === row.question_text);
      if (matched) image_base64 = matched.image_base64 || null;
    } catch(e) {
      console.warn('[活水泉源] 讀取 image_base64 失敗:', e.message);
    }

    return res.status(200).json({
      success: true,
      data: {
        weekly_card_id: row.weekly_cards_id,
        id: row.ai_question_id,
        day: row.day_no,
        question: row.question_text,
        theme: row.theme,
        quote: row.quote,
        quote_source: row.quote_source,
        image_url: row.image_url,
        image_prompt: row.image_prompt,
        image_base64,
      }
    });

  } catch (error) {
    console.error('[活水泉源] getDailyCard 錯誤：', error.message);
    return res.status(500).json({ success: false, message: '取得今日題目失敗', error: error.message });
  }
};

// ============================================================
// POST /api/livingwater/record-draw
// 使用者點開卡片時記錄（建立 user_draws 紀錄）
// Body: { weekly_card_id }
// ============================================================
const recordDrawController = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: '請先登入' });

    const { weekly_card_id } = req.body;
    if (!weekly_card_id) {
      return res.status(400).json({ success: false, message: '缺少 weekly_card_id' });
    }

    // 檢查是否已經有記錄（避免重複）
    const existing = await pool.query(
      'SELECT user_draws_id FROM user_draws WHERE user_id = $1 AND weekly_card_id = $2',
      [userId, weekly_card_id]
    );

    if (existing.rows.length > 0) {
      // 已有記錄，直接回傳
      return res.status(200).json({
        success: true,
        data: { user_draws_id: existing.rows[0].user_draws_id, already_drawn: true }
      });
    }

    // 建立新的抽卡記錄
    const result = await pool.query(
      'INSERT INTO user_draws (user_id, weekly_card_id, drawdate, is_completed, created_at) VALUES ($1, $2, CURRENT_DATE, false, NOW()) RETURNING user_draws_id',
      [userId, weekly_card_id]
    );

    return res.status(201).json({
      success: true,
      data: { user_draws_id: result.rows[0].user_draws_id, already_drawn: false }
    });

  } catch (error) {
    console.error('[活水泉源] recordDraw 錯誤：', error.message);
    return res.status(500).json({ success: false, message: '記錄抽卡失敗', error: error.message });
  }
};

// ============================================================
// POST /api/livingwater/complete-draw
// 完成整個流程（到 letter）後標記已完成
// Body: { user_draws_id, summary, letter_quote, letter_quote_source, conversation_id }
// ============================================================
const completeDrawController = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: '請先登入' });

    const { user_draws_id, summary, letter_quote, letter_quote_source, conversation_id } = req.body;
    if (!user_draws_id) {
      return res.status(400).json({ success: false, message: '缺少 user_draws_id' });
    }

    // 更新 is_completed = true 並儲存信箋內容
    const result = await pool.query(
      `UPDATE user_draws 
       SET is_completed = true, 
           summary = $1, 
           letter_quote = $2, 
           letter_quote_source = $3,
           conversation_id = $4
       WHERE user_draws_id = $5 AND user_id = $6
       RETURNING *`,
      [summary || null, letter_quote || null, letter_quote_source || null, conversation_id || null, user_draws_id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '找不到抽卡記錄' });
    }

    return res.status(200).json({ success: true, data: result.rows[0] });

  } catch (error) {
    console.error('[活水泉源] completeDraw 錯誤：', error.message);
    return res.status(500).json({ success: false, message: '更新完成狀態失敗', error: error.message });
  }
};

// ============================================================
// GET /api/livingwater/my-draws
// 取得使用者本週的抽卡狀態
// ============================================================
const getMyDrawsController = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: '請先登入' });

    const weekStartDate = getWeekStartDate();

    // 查詢本週已抽的卡片
    const result = await pool.query(
      `SELECT ud.user_draws_id, ud.weekly_card_id, ud.is_completed, ud.drawdate,
              wc.day_no
       FROM user_draws ud
       JOIN weekly_cards wc ON ud.weekly_card_id = wc.weekly_cards_id
       WHERE ud.user_id = $1 AND wc.weekly_start_date = $2`,
      [userId, weekStartDate]
    );

    // 回傳已抽的 weekly_card_id 列表（前端用來判斷哪些卡已抽）
    return res.status(200).json({
      success: true,
      data: result.rows,
      drawn_card_ids: result.rows.map(r => r.weekly_card_id),
    });

  } catch (error) {
    console.error('[活水泉源] getMyDraws 錯誤：', error.message);
    return res.status(500).json({ success: false, message: '取得抽卡記錄失敗', error: error.message });
  }
};

// ============================================================
// POST /api/livingwater/generate-letter
// ============================================================
const generateLetterController = async (req, res) => {
  try {
    const { question, theme, source_hint, conversation } = req.body;

    if (!question || !theme || !conversation) {
      return res.status(400).json({
        success: false,
        message: '缺少必填欄位：question、theme、conversation 為必填',
      });
    }

    if (typeof conversation !== 'string' || conversation.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'conversation 必須是非空字串',
      });
    }

    const letterData = await generateLetter({ question, theme, source_hint, conversation });

    return res.status(200).json({ success: true, data: letterData });

  } catch (error) {
    console.error('[活水泉源] generateLetter 錯誤：', error.message);

    if (error instanceof SyntaxError) {
      return res.status(502).json({ success: false, message: 'AI 回傳格式異常，請重試' });
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ success: false, message: 'AI 服務暫時無法連線' });
    }

    return res.status(500).json({ success: false, message: '伺服器內部錯誤', error: error.message });
  }
};

// ============================================================
// POST /api/livingwater/generate-image
// ============================================================
const generateImageController = async (req, res) => {
  try {
    const { image_prompt } = req.body;

    if (!image_prompt) {
      return res.status(400).json({ success: false, message: '缺少必填欄位：image_prompt' });
    }

    const imageData = await generateImage(image_prompt);
    return res.status(200).json({ success: true, data: imageData });

  } catch (error) {
    console.error('[活水泉源] generateImage 錯誤：', error.message);
    return res.status(500).json({ success: false, message: '圖片生成失敗', error: error.message });
  }
};

// 匯出給 Route 使用
module.exports = {
  generateLetterController,
  generateImageController,
  getDailyCardController,
  getWeeklyCardsController,
  recordDrawController,
  completeDrawController,
  getMyDrawsController,
};