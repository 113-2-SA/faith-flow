// controllers/shareController.js
const shareService = require('../services/shareservice');
const postService = require('../services/postservice');

class ShareController {
    // 轉發貼文
    async sharePost(req, res, next) {
        try {
            const postId = parseInt(req.params.postId);
            const userId = req.userId;
            const { share_caption, visibility } = req.body;

            // 檢查貼文是否存在
            const postExists = await postService.getPostById(postId);
            if (!postExists) {
                return res.status(404).json({
                    ok: false,
                    error: '找不到該貼文'
                });
            }

            // 檢查是否已經轉發過
            const hasShared = await shareService.hasUserShared(postId, userId);
            if (hasShared) {
                return res.status(400).json({
                    ok: false,
                    error: '已經轉發過這篇貼文'
                });
            }

            const shareData = {
                original_post_id: postId,
                shared_by_user_id: userId,
                share_caption,
                visibility: visibility || 'public'
            };

            const result = await shareService.sharePost(shareData);

            if (!result.success) {
                return res.status(400).json({
                    ok: false,
                    error: result.error
                });
            }

            res.status(201).json({
                ok: true,
                message: result.message,
                data: result.data
            });

        } catch (error) {
            console.error('[sharePost] 錯誤:', error);
            next(error);
        }
    }

    // 取消轉發
    async unsharePost(req, res, next) {
        try {
            const shareId = parseInt(req.params.shareId);
            const userId = req.userId;

            const result = await shareService.unsharePost(shareId, userId);

            if (!result.success) {
                return res.status(404).json({
                    ok: false,
                    error: result.error
                });
            }

            res.json({
                ok: true,
                message: result.message
            });

        } catch (error) {
            console.error('[unsharePost] 錯誤:', error);
            next(error);
        }
    }

    // 獲取貼文的轉發列表
    async getPostShares(req, res, next) {
        try {
            const postId = parseInt(req.params.postId);
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;

            const postExists = await postService.getPostById(postId);
            if (!postExists) {
                return res.status(404).json({
                    ok: false,
                    error: '找不到該貼文'
                });
            }

            const [shares, total] = await Promise.all([
                shareService.getPostShares(postId, { limit, offset }),
                shareService.getPostSharesCount(postId)
            ]);

            res.json({
                ok: true,
                data: shares,
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + limit < total
                }
            });

        } catch (error) {
            console.error('[getPostShares] 錯誤:', error);
            next(error);
        }
    }

    // 檢查轉發狀態
    async checkShareStatus(req, res, next) {
        try {
            const postId = parseInt(req.params.postId);
            const userId = req.userId;

            const hasShared = await shareService.hasUserShared(postId, userId);
            const shareCount = await shareService.getPostSharesCount(postId);

            res.json({
                ok: true,
                data: {
                    hasShared,
                    shareCount
                }
            });

        } catch (error) {
            console.error('[checkShareStatus] 錯誤:', error);
            next(error);
        }
    }
}

module.exports = new ShareController();