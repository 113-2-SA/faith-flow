// controllers/likeController.js
const likeService = require('../services/likeservice');
const postService = require('../services/postservice');

class LikeController {
    // 點讚/取消點讚（切換）
    async toggleLike(req, res, next) {
        try {
            const postId = parseInt(req.params.postId);
            const userId = req.userId;

            // 檢查貼文是否存在
            if (!await postService.postExists(postId)) {
                return res.status(404).json({ ok: false, error: '找不到該貼文' });
            }

            const result = await likeService.toggleLike(postId, userId);

            res.json({
                ok: true,
                message: result.message,
                data: {
                    isLiked: result.isLiked,
                    likeCount: await likeService.getPostLikesCount(postId)
                }
            });

        } catch (error) {
            console.error('[toggleLike] 錯誤:', error);
            next(error);
        }
    }

    // 點讚
    async likePost(req, res, next) {
        try {
            const postId = parseInt(req.params.postId);
            const userId = req.userId;

            if (!await postService.postExists(postId)) {
                return res.status(404).json({ ok: false, error: '找不到該貼文' });
            }

            const result = await likeService.likePost(postId, userId);

            res.status(result.success ? 201 : 400).json({
                ok: result.success,
                message: result.message,
                data: {
                    isLiked: result.isLiked,
                    likeCount: await likeService.getPostLikesCount(postId)
                }
            });

        } catch (error) {
            console.error('[likePost] 錯誤:', error);
            next(error);
        }
    }

    // 取消點讚
    async unlikePost(req, res, next) {
        try {
            const postId = parseInt(req.params.postId);
            const userId = req.userId;

            const result = await likeService.unlikePost(postId, userId);

            res.json({
                ok: result.success,
                message: result.message,
                data: {
                    isLiked: result.isLiked,
                    likeCount: await likeService.getPostLikesCount(postId)
                }
            });

        } catch (error) {
            console.error('[unlikePost] 錯誤:', error);
            next(error);
        }
    }

    // 獲取貼文的點讚列表
    async getPostLikes(req, res, next) {
        try {
            const postId = parseInt(req.params.postId);
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;

            if (!await postService.postExists(postId)) {
                return res.status(404).json({ ok: false, error: '找不到該貼文' });
            }

            const [likes, total] = await Promise.all([
                likeService.getPostLikes(postId, { limit, offset }),
                likeService.getPostLikesCount(postId)
            ]);

            res.json({
                ok: true,
                data: likes,
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + limit < total
                }
            });

        } catch (error) {
            console.error('[getPostLikes] 錯誤:', error);
            next(error);
        }
    }

    // 檢查點讚狀態
    async checkLikeStatus(req, res, next) {
        try {
            const postId = parseInt(req.params.postId);
            const userId = req.userId;

            const isLiked = await likeService.isPostLiked(postId, userId);
            const likeCount = await likeService.getPostLikesCount(postId);

            res.json({
                ok: true,
                data: {
                    isLiked,
                    likeCount
                }
            });

        } catch (error) {
            console.error('[checkLikeStatus] 錯誤:', error);
            next(error);
        }
    }

    // 獲取我點讚的所有貼文
    async getMyLikedPosts(req, res, next) {
        try {
            const userId = req.userId;
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;

            const [posts, total] = await Promise.all([
                likeService.getUserLikedPosts(userId, { limit, offset }),
                likeService.getUserLikedPostsCount(userId)
            ]);

            res.json({
                ok: true,
                data: posts,
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + limit < total
                }
            });

        } catch (error) {
            console.error('[getMyLikedPosts] 錯誤:', error);
            next(error);
        }
    }
}

// ⭐ 重要：確保正確導出
module.exports = new LikeController();