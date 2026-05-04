// ============================================================
// livingwatercontroller.js
// 活水泉源 — Controller 層
// 職責：接收 request、驗證參數、呼叫 service、回傳 response
// ============================================================

const { generateLetter, generateImage } = require('../services/livingwaterservice');

// ============================================================
// POST /api/livingwater/generate-letter
// 使用者結束對話後呼叫，生成信箋（摘要＋金句＋生圖prompt）
// ============================================================
const generateLetterController = async (req, res) => {
  try {
    // ── 從 request body 取出前端傳來的資料 ──
    const { question, theme, source_hint, conversation } = req.body;

    // ── 基本驗證：必填欄位不能空白 ──
    if (!question || !theme || !conversation) {
      return res.status(400).json({
        success: false,
        message: '缺少必填欄位：question、theme、conversation 為必填',
      });
    }

    // conversation 必須是字串（前端傳來的對話記錄）
    if (typeof conversation !== 'string' || conversation.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'conversation 必須是非空字串',
      });
    }

    // ── 呼叫 Service 層處理核心邏輯 ──
    const letterData = await generateLetter({
      question,
      theme,
      source_hint,
      conversation,
    });

    // ── 回傳成功結果給前端 ──
    return res.status(200).json({
      success: true,
      data: letterData,
      // letterData 包含：
      // {
      //   summary: '對話摘要',
      //   quote: '金句',
      //   quote_source: '出處',
      //   image_prompt: 'Qwen 生圖 prompt'
      // }
    });

  } catch (error) {
    // ── 錯誤處理：區分不同錯誤類型 ──
    console.error('[活水泉源] generateLetter 錯誤：', error.message);

    // Qwen 回傳的 JSON 格式解析失敗
    if (error instanceof SyntaxError) {
      return res.status(502).json({
        success: false,
        message: 'AI 回傳格式異常，請重試',
      });
    }

    // Qwen 連線逾時或網路問題
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({
        success: false,
        message: 'AI 服務暫時無法連線，請確認 VM 是否開機',
      });
    }
console.error('[詳細錯誤]', {
  message: error.message,
  status: error.response?.status,
  url: error.config?.url,
  data: error.response?.data,
});
    // 其他未知錯誤
    return res.status(500).json({
      success: false,
      message: '伺服器內部錯誤',
      error: error.message,
    });
  }
};

// ============================================================
// POST /api/livingwater/generate-image
// 拿 image_prompt 去 Qwen 生成圖片
// ============================================================
const generateImageController = async (req, res) => {
  try {
    const { image_prompt } = req.body;

    if (!image_prompt) {
      return res.status(400).json({
        success: false,
        message: '缺少必填欄位：image_prompt',
      });
    }

    const imageData = await generateImage(image_prompt);

    return res.status(200).json({
      success: true,
      data: imageData,
    });

  } catch (error) {
    console.error('[活水泉源] generateImage 錯誤：', error.message);
    console.error('[活水泉源] generateImage 錯誤：', {
  message: error.message,
  status: error.response?.status,
  data: error.response?.data ? Buffer.from(error.response.data).toString('utf8') : undefined,
});

    return res.status(500).json({
      success: false,
      message: '圖片生成失敗',
      error: error.message,
    });
  }
};

// ============================================================
// GET /api/livingwater/daily-card
// 取得今日抽卡題目
// ============================================================
const getDailyCardController = async (req, res) => {
  try {
    const questions = require('../scripts/faithflow_questions_with_assets.json');

    // ── 計算本週是第幾週（用來決定本週的5題）──
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.floor((now - startOfYear) / (7 * 24 * 60 * 60 * 1000));

    // ── 用週數當 seed，固定本週5題 ──
    // 簡單的 seed 算法：讓同一週永遠抽到同樣5題
    const seededRandom = (seed) => {
      const x = Math.sin(seed + 1) * 10000;
      return x - Math.floor(x);
    };

    // 選出本週5題的 index
    const weeklyIndexes = [];
    let seed = weekNumber * 100;
    while (weeklyIndexes.length < 5) {
      const idx = Math.floor(seededRandom(seed) * questions.length);
      if (!weeklyIndexes.includes(idx)) {
        weeklyIndexes.push(idx);
      }
      seed++;
    }

    // ── 今天是週幾（0=週日, 1=週一...5=週五）──
    // 週一到週五各對應一題，週六/週日用週五的題
    const dayOfWeek = Math.min(now.getDay() === 0 ? 4 : now.getDay() - 1, 4);
    const todayQuestion = questions[weeklyIndexes[dayOfWeek]];

    // ── 回傳（不含 image_base64，圖片另外用 /get-card-image 取）──
    return res.status(200).json({
      success: true,
      data: {
        id: todayQuestion.id,
        question: todayQuestion.question,
        theme: todayQuestion.theme,
        depth: todayQuestion.depth,
        quote: todayQuestion.quote,
        quote_source: todayQuestion.quote_source,
        image_prompt: todayQuestion.image_prompt,
        // 圖片先一起回傳，之後 DB 版改成回傳 image_url
        image_base64: todayQuestion.image_base64,
      }
    });

  } catch (error) {
    console.error('[活水泉源] getDailyCard 錯誤：', error.message);
    return res.status(500).json({
      success: false,
      message: '取得今日題目失敗',
      error: error.message,
    });
  }
};

// ============================================================
// GET /api/livingwater/weekly-cards
// 取得本週五題（不含圖片，給卡冊列表用）
// ============================================================
const getWeeklyCardsController = async (req, res) => {
  try {
    const questions = require('../scripts/faithflow_questions_with_assets.json');

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.floor((now - startOfYear) / (7 * 24 * 60 * 60 * 1000));

    const seededRandom = (seed) => {
      const x = Math.sin(seed + 1) * 10000;
      return x - Math.floor(x);
    };

    const weeklyIndexes = [];
    let seed = weekNumber * 100;
    while (weeklyIndexes.length < 5) {
      const idx = Math.floor(seededRandom(seed) * questions.length);
      if (!weeklyIndexes.includes(idx)) weeklyIndexes.push(idx);
      seed++;
    }

    const weeklyCards = weeklyIndexes.map((idx, i) => ({
      day: i + 1, // 1=週一 ~ 5=週五
      id: questions[idx].id,
      question: questions[idx].question,
      theme: questions[idx].theme,
      depth: questions[idx].depth,
      quote: questions[idx].quote,
      quote_source: questions[idx].quote_source,
    }));

    return res.status(200).json({
      success: true,
      data: weeklyCards,
    });

  } catch (error) {
    console.error('[活水泉源] getWeeklyCards 錯誤：', error.message);
    return res.status(500).json({
      success: false,
      message: '取得本週題目失敗',
      error: error.message,
    });
  }
};

// 匯出給 Route 使用
module.exports = {
  generateLetterController,
  generateImageController,
  getDailyCardController,
  getWeeklyCardsController,
};
