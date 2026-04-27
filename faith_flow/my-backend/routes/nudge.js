// ==================== routes/nudge.js ====================
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const attachUserId = require('../middleware/attachuserId');
const nudgeController = require('../controllers/nudgeController');

const auth = [verifyToken, attachUserId];

// 取得待顯示的光點回顧（首頁停留 4 秒後呼叫）
router.get('/pending', auth, nudgeController.getPending);

// 標記已顯示
router.patch('/:id/shown', auth, nudgeController.markShown);

// 記錄使用者行動（dismissed / conversation_started）
router.patch('/:id/action', auth, nudgeController.recordAction);

// 提交評分反饋
router.post('/:id/feedback', auth, nudgeController.submitFeedback);

module.exports = router;
