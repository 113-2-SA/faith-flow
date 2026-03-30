// routes/like.js
const express = require('express');
const router = express.Router();
const likeController = require('../controllers/likecontroller');
const { verifyToken } = require('../middleware/auth');
const attachUserId = require('../middleware/attachuserId');

// 所有路由都需要認證
router.use(verifyToken);
router.use(attachUserId);

// ⭐ 重要：路由順序很關鍵！
// 具體路徑要放在動態路徑之前

// 1. 獲取我點讚的所有貼文（必須放在最前面）
router.get('/my', likeController.getMyLikedPosts);

// 2. 點讚/取消點讚（切換）
router.post('/:postId/toggle', likeController.toggleLike);

// 3. 檢查點讚狀態（必須放在 /:postId 之前）
router.get('/:postId/status', likeController.checkLikeStatus);

// 4. 點讚
router.post('/:postId', likeController.likePost);

// 5. 取消點讚
router.delete('/:postId', likeController.unlikePost);

// 6. 獲取點讚列表（放在最後）
router.get('/:postId', likeController.getPostLikes);

module.exports = router;