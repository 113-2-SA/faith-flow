// routes/postRoutes.js
const express = require('express');
const router = express.Router();
const postController = require('../controllers/postcontroller');
const { uploadSingleImage } = require('../middleware/picupload');

// 中介軟體，目前所有功能需要登入驗證
const { verifyToken } = require('../middleware/auth');           // Firebase Token 驗證
const attachUserId = require('../middleware/attachuserId');      // 取得 userId

// ==================== 貼文路由 ====================

// ⭐ 新增貼文（需要登入 + 圖片上傳）
router.post('/',
    verifyToken,
    attachUserId,
    // ③ multer 前：確認 Content-Type
    (req, res, next) => {
        console.log('🔍 [POST /api/post] Content-Type:', req.headers['content-type']);
        console.log('🔍 [POST /api/post] Content-Length:', req.headers['content-length']);
        next();
    },
    uploadSingleImage,
    // ④ multer 後：確認 req.file 是否到達
    (req, res, next) => {
        console.log('🔍 [multer 結果] req.file:', req.file
            ? { fieldname: req.file.fieldname, originalname: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size, hasBuffer: !!req.file.buffer }
            : 'undefined ← 圖片沒收到！'
        );
        console.log('🔍 [multer 結果] req.body keys:', Object.keys(req.body));
        next();
    },
    postController.createPost
);

// ⭐ 獲取貼文列表（需要登入）
router.get('/', 
    verifyToken,
    attachUserId,
    postController.getPosts
);

// ⭐ 獲取我的貼文（需要登入）
router.get('/my', 
    verifyToken,
    attachUserId,
    postController.getMyPosts
);

// ⭐ 獲取單一貼文（需要登入）
router.get('/:id', 
    verifyToken,
    attachUserId,
    postController.getPostById
);

// ⭐ 更新貼文（需要登入 + 可選圖片上傳）
router.put('/:id', 
    verifyToken,
    attachUserId,
    uploadSingleImage,     // 可選：如果有上傳新圖片
    postController.updatePost
);

// ⭐ 刪除貼文（需要登入）
router.delete('/:id',
    verifyToken,
    attachUserId,
    postController.deletePost
);

// ⭐ 檢舉貼文（需要登入）
router.post('/:id/report',
    verifyToken,
    attachUserId,
    postController.reportPost
);

// ⭐ 取得所有待處理的檢舉（管理員）
router.get('/reports/pending',
    verifyToken,
    attachUserId,
    postController.getAllPendingReports
);

// ⭐ 取得貼文的所有檢舉（管理員）
router.get('/:id/reports',
    verifyToken,
    attachUserId,
    postController.getPostReports
);

// ⭐ 標記貼文所有檢舉為已解決（管理員）
router.put('/:id/reports/resolve',
    verifyToken,
    attachUserId,
    postController.resolvePostReports
);

// ⭐ 標記留言所有檢舉為已解決（管理員）
router.put('/comment/:id/reports/resolve',
    verifyToken,
    attachUserId,
    postController.resolveCommentReports
);

// ⭐ 管理員刪除貼文（解決檢舉 + 刪除）
router.delete('/:id/admin',
    verifyToken,
    attachUserId,
    postController.adminDeletePost
);

module.exports = router;