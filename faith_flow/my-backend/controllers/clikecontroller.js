// controllers/commentLikeController.js
const commentLikeService = require('../services/clikeservice');
const commentService = require('../services/commentservice');

class CommentLikeController {
    // 點讚/取消點讚（切換）
    async toggleLike(req, res, next) {
        try {
            const commentId = parseInt(req.params.commentId);
            const userId = req.userId;

            // 檢查留言是否存在
            const commentExists = await commentService.commentExists(commentId);
            if (!commentExists) {
                return res.status(404).json({
                    ok: false,
                    error: '找不到該留言'
                });
            }

            const result = await commentLikeService.toggleLike(commentId, userId);

            res.json({
                ok: result.success,
                message: result.message,
                data: {
                    isLiked: result.isLiked,
                    likeCount: await commentLikeService.getCommentLikesCount(commentId)
                }
            });

        } catch (error) {
            console.error('[toggleLike] 錯誤:', error);
            next(error);
        }
    }

    // 點讚留言
    async likeComment(req, res, next) {
        try {
            const commentId = parseInt(req.params.commentId);
            const userId = req.userId;

            const commentExists = await commentService.commentExists(commentId);
            if (!commentExists) {
                return res.status(404).json({
                    ok: false,
                    error: '找不到該留言'
                });
            }

            const result = await commentLikeService.likeComment(commentId, userId);

            res.status(result.success ? 201 : 400).json({
                ok: result.success,
                message: result.message,
                data: {
                    isLiked: result.isLiked,
                    likeCount: await commentLikeService.getCommentLikesCount(commentId)
                }
            });

        } catch (error) {
            console.error('[likeComment] 錯誤:', error);
            next(error);
        }
    }

    // 取消點讚留言
    async unlikeComment(req, res, next) {
        try {
            const commentId = parseInt(req.params.commentId);
            const userId = req.userId;

            const result = await commentLikeService.unlikeComment(commentId, userId);

            res.json({
                ok: result.success,
                message: result.message,
                data: {
                    isLiked: result.isLiked,
                    likeCount: await commentLikeService.getCommentLikesCount(commentId)
                }
            });

        } catch (error) {
            console.error('[unlikeComment] 錯誤:', error);
            next(error);
        }
    }

    // 獲取留言的點讚列表
    async getCommentLikes(req, res, next) {
        try {
            const commentId = parseInt(req.params.commentId);
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;

            const commentExists = await commentService.commentExists(commentId);
            if (!commentExists) {
                return res.status(404).json({
                    ok: false,
                    error: '找不到該留言'
                });
            }

            const [likes, total] = await Promise.all([
                commentLikeService.getCommentLikes(commentId, { limit, offset }),
                commentLikeService.getCommentLikesCount(commentId)
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
            console.error('[getCommentLikes] 錯誤:', error);
            next(error);
        }
    }

    // 檢查點讚狀態
    async checkLikeStatus(req, res, next) {
        try {
            const commentId = parseInt(req.params.commentId);
            const userId = req.userId;

            const isLiked = await commentLikeService.isCommentLiked(commentId, userId);
            const likeCount = await commentLikeService.getCommentLikesCount(commentId);

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
}

module.exports = new CommentLikeController();