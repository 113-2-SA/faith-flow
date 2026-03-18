// routes/commentLike.js
const express = require('express');
const router = express.Router();
const commentLikeController = require('../controllers/clikecontroller');
const { verifyToken } = require('../middleware/auth');
const attachUserId = require('../middleware/attachuserId');
const { validateCommentIdParam } = require('../middleware/validation');

// 所有路由都需要認證
router.use(verifyToken);
router.use(attachUserId);

// ⭐ 重要：路由順序很關鍵！具體路徑要放在動態路徑之前

// 點讚/取消點讚（切換）- 推薦使用
router.post('/:commentId/toggle', validateCommentIdParam, commentLikeController.toggleLike);

// 檢查點讚狀態
router.get('/:commentId/status', validateCommentIdParam, commentLikeController.checkLikeStatus);

// 點讚留言
router.post('/:commentId', validateCommentIdParam, commentLikeController.likeComment);

// 取消點讚留言
router.delete('/:commentId', validateCommentIdParam, commentLikeController.unlikeComment);

// 獲取留言的點讚列表
router.get('/:commentId', validateCommentIdParam, commentLikeController.getCommentLikes);

module.exports = router;