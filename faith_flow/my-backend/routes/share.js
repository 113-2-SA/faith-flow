// routes/shareRoutes.js
const express = require('express');
const router = express.Router();
const shareController = require('../controllers/sharecontroller');
const { verifyToken } = require('../middleware/auth');
const attachUserId = require('../middleware/attachuserId');
const { validateSharePost } = require('../middleware/validation');

// 所有路由都需要認證
router.use(verifyToken);
router.use(attachUserId);

// 轉發貼文
router.post('/:postId', validateSharePost, shareController.sharePost);

// 取消轉發
router.delete('/:shareId', shareController.unsharePost);

// 獲取轉發列表
router.get('/:postId', shareController.getPostShares);

// 檢查轉發狀態
router.get('/:postId/status', shareController.checkShareStatus);

module.exports = router;