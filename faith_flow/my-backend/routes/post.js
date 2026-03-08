// routes/postRoutes.js
const express = require('express');
const router = express.Router();
const postController = require('../controllers/postcontroller');
const { verifyToken } = require('../middleware/auth');
const attachUserId = require('../middleware/attachuserId');
const { validateCreatePost, validatePostId } = require('../middleware/validation');

// ⭐ 所有路由都需要 Firebase 認證 + 取得 userID
router.use(verifyToken);      // 驗證 Firebase token
router.use(attachUserId);     // 取得 int userID

// 新增貼文
router.post('/', validateCreatePost, postController.createPost);

// 獲取我的貼文
router.get('/my', postController.getMyPosts);

// 獲取貼文列表（可用 query 參數篩選）
router.get('/', postController.getPosts);

// 獲取單一貼文
router.get('/:id', validatePostId, postController.getPostById);

// 刪除貼文
router.delete('/:id', validatePostId, postController.deletePost);

module.exports = router;