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

    return res.status(500).json({
      success: false,
      message: '圖片生成失敗',
      error: error.message,
    });
  }
};

// 匯出給 Route 使用
module.exports = { generateLetterController, generateImageController };