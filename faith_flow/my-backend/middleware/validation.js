// middleware/validation.js
const { body, param, validationResult } = require('express-validator');

const validateCreatePost = [
    body('post_text')
        .trim()
        .notEmpty().withMessage('內文不能為空')
        .isLength({ max: 5000 }).withMessage('內文不能超過5000字'),
    
    body('post_type')
        .isIn(['letter', 'diary', 'original']).withMessage('無效的貼文類型'),
    
    body('visibility')
        .optional()
        .isIn(['public', 'private', 'friends']).withMessage('無效的可見性設定'),
    
    body('tags')
        .optional()
        .isArray().withMessage('標籤必須是陣列')
        .custom((tags) => {
            if (!Array.isArray(tags)) return false;
            return tags.every(tag => typeof tag === 'string' && tag.length <= 50);
        })
        .withMessage('標籤格式錯誤或超過50字'),
    
    body('letter_id')
        .optional()
        .isInt({ min: 1 }).withMessage('letter_id 必須是正整數'),
    
    body('diary_id')
        .optional()
        .isInt({ min: 1 }).withMessage('diary_id 必須是正整數'),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                ok: false,
                errors: errors.array() 
            });
        }
        next();
    }
];

const validatePostId = [
    param('id')
        .isInt({ min: 1 }).withMessage('貼文 ID 必須是正整數'),
    
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                ok: false,
                errors: errors.array() 
            });
        }
        next();
    }
];

const validateCreateComment = [
    body('post_id')
        .isInt({ min: 1 }).withMessage('post_id 必須是正整數'),
    
    body('comment_content')
        .trim()
        .notEmpty().withMessage('留言內容不能為空')
        .isLength({ max: 1000 }).withMessage('留言內容不能超過1000字'),
    
    body('parent_comment_id')
        .optional()
        .isInt({ min: 1 }).withMessage('parent_comment_id 必須是正整數'),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                ok: false,
                errors: errors.array() 
            });
        }
        next();
    }
];

const validateCommentId = [
    param('id')
        .isInt({ min: 1 }).withMessage('留言 ID 必須是正整數'),
    
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                ok: false,
                errors: errors.array() 
            });
        }
        next();
    }
];

const validateSharePost = [
    body('share_caption')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('轉發說明不能超過500字'),
    
    body('visibility')
        .optional()
        .isIn(['public', 'private', 'friends']).withMessage('無效的可見性設定'),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                ok: false,
                errors: errors.array() 
            });
        }
        next();
    }
];

module.exports = { 
    validateCreatePost,
    validatePostId,
    validateCreateComment,  
    validateCommentId,     
    validateSharePost
};
