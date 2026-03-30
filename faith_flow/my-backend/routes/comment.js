// routes/comment.js
const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentcontroller');
const { verifyToken } = require('../middleware/auth');
const attachUserId = require('../middleware/attachuserId');
const { validateCreateComment, validateCommentId } = require('../middleware/validation');

// 所有路由都需要 Firebase 認證 + 取得 userID
router.use(verifyToken);
router.use(attachUserId);

// 新增留言或回覆
router.post('/', validateCreateComment, commentController.createComment);

// 獲取貼文的所有留言（含回覆）
router.get('/post/:postId', commentController.getCommentsByPost);

// 獲取留言的回覆列表
router.get('/:commentId/replies', commentController.getRepliesByComment);

// 獲取單一留言
router.get('/:id', validateCommentId, commentController.getCommentById);

// 刪除留言
router.delete('/:id', validateCommentId, commentController.deleteComment);

module.exports = router;