const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const attachUserId = require('../middleware/attachuserId'); 

module.exports = (weeklySummaryController) => {
  // 所有路由都需要先驗證 Firebase token，再轉換成 userID
  const authMiddleware = [verifyToken, attachUserId];

  // 生成特定周回顧
  router.post('/generate',
    authMiddleware,
    (req, res) => weeklySummaryController.generateSpecificWeek(req, res)
  );

  // 補齊所有有日記但尚未生成回顧的週
  router.post('/generate-all',
    authMiddleware,
    (req, res) => weeklySummaryController.generateAllMissing(req, res)
  );

  // 獲取歷史回顧列表
  router.get('/', 
    authMiddleware, 
    (req, res) => weeklySummaryController.getWeeklySummaries(req, res)
  );

  // 獲取特定周回顧
  router.get('/:year/:weekNumber', 
    authMiddleware, 
    (req, res) => weeklySummaryController.getWeeklySummary(req, res)
  );

  // 刪除特定周回顧
  router.delete('/:year/:weekNumber',
    authMiddleware,
    (req, res) => weeklySummaryController.deleteWeeklySummary(req, res)
  );

  // 為特定周生成語音
  router.post('/:year/:weekNumber/audio',
    authMiddleware,
    (req, res) => weeklySummaryController.generateAudioForWeek(req, res)
  );

  // 播放語音
  router.get('/:year/:weekNumber/audio',
    authMiddleware,
    (req, res) => weeklySummaryController.streamAudio(req, res)
  );

  // 手動觸發自動生成（管理員）
  router.post('/admin/trigger',
    authMiddleware, // 你可能需要額外的 admin 檢查
    (req, res) => weeklySummaryController.manualTrigger(req, res)
  );

  return router;
};