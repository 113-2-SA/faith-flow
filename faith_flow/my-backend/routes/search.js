// routes/searchRoutes.js
const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchcontroller');
const { verifyToken } = require('../middleware/auth');
const attachUserId = require('../middleware/attachuserId');

// 🔐 需要登入的搜尋功能 (使用你的兩個 middleware)
router.get('/diary', 
  verifyToken,      // 先驗證 Firebase token
  attachUserId,     // 再取得系統 userID
  searchController.searchDiary
);

router.get('/messages', 
  verifyToken, 
  attachUserId, 
  searchController.searchMessages
);

// 🌍 社群搜尋（需登入，可取得 is_liked 等個人化資料）
router.get('/community/posts',
  verifyToken,
  searchController.searchPosts
);

module.exports = router;