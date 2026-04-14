// middleware/uploadMiddleware.js
const multer = require('multer');

// 使用記憶體儲存（因為我們要直接上傳到 R2）
const storage = multer.memoryStorage();

// Multer 配置（不做 fileFilter，型別驗證由 controller 統一處理）
const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024,
    },
});

// 單一圖片上傳中間件
const uploadSingleImage = upload.single('post_pic');

// 錯誤處理包裝器
const handleUploadError = (req, res, next) => {
    uploadSingleImage(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Multer 錯誤
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    ok: false,
                    error: `檔案大小超過限制（最大 ${process.env.MAX_FILE_SIZE / (1024 * 1024)}MB）`
                });
            }
            return res.status(400).json({
                ok: false,
                error: `檔案上傳錯誤: ${err.message}`
            });
        } else if (err) {
            // 其他錯誤（例如檔案類型錯誤）
            return res.status(400).json({
                ok: false,
                error: err.message
            });
        }
        
        // 沒有錯誤，繼續
        next();
    });
};

module.exports = {
    uploadSingleImage: handleUploadError,
    upload
};