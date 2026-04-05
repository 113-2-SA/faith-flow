// ============================================================
// livingwater.js (route)
// 活水泉源 — Route 層
// 職責：定義 API 路徑，連接 Controller
// ============================================================

const express = require('express');
const router = express.Router();
const {
  generateLetterController,
  generateImageController,
  getDailyCardController,
  getWeeklyCardsController,
} = require('../controllers/livingwatercontroller');

// POST /api/livingwater/generate-letter
// 對話結束後生成信箋
router.post('/generate-letter', generateLetterController);

// POST /api/livingwater/generate-image
// 根據 image_prompt 生成圖片
router.post('/generate-image', generateImageController);

// GET /api/livingwater/daily-card
// 取得今日抽卡題目（含金句與圖片）
router.get('/daily-card', getDailyCardController);

// GET /api/livingwater/weekly-cards
// 取得本週五題（給卡冊列表用）
router.get('/weekly-cards', getWeeklyCardsController);

module.exports = router;