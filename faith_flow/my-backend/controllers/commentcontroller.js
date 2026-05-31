// controllers/commentController.js
const commentService = require('../services/commentservice');

class CommentController {
    // 新增留言或回覆
    async createComment(req, res, next) {
        try {
            const { post_id, parent_comment_id, comment_content } = req.body;
            const userId = req.userId;

            // 驗證貼文是否存在
            const postExists = await commentService.postExists(post_id);
            if (!postExists) {
                return res.status(404).json({
                    ok: false,
                    error: '找不到該貼文'
                });
            }

            // 如果是回覆留言，驗證父留言是否存在
            if (parent_comment_id) {
                const commentExists = await commentService.commentExists(parent_comment_id);
                if (!commentExists) {
                    return res.status(404).json({
                        ok: false,
                        error: '找不到要回覆的留言'
                    });
                }
            }

            const commentData = {
                post_id,
                user_id: userId,
                parent_comment_id,
                comment_content
            };

            const comment = await commentService.createComment(commentData);

            res.status(201).json({
                ok: true,
                message: parent_comment_id ? '回覆成功' : '留言成功',
                data: comment
            });

        } catch (error) {
            console.error('[createComment] 錯誤:', error);
            next(error);
        }
    }

    // 獲取貼文的所有留言
    async getCommentsByPost(req, res, next) {
        try {
            const postId = parseInt(req.params.postId);
            const userId = req.userId;
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;

            // 驗證貼文是否存在
            const postExists = await commentService.postExists(postId);
            if (!postExists) {
                return res.status(404).json({
                    ok: false,
                    error: '找不到該貼文'
                });
            }

            const [comments, total] = await Promise.all([
                commentService.getCommentsByPostId(postId, userId, { limit, offset }),
                commentService.getCommentsCount(postId)
            ]);

            res.json({
                ok: true,
                data: comments,
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + limit < total
                }
            });

        } catch (error) {
            console.error('[getCommentsByPost] 錯誤:', error);
            next(error);
        }
    }

    // 獲取留言的回覆列表
    async getRepliesByComment(req, res, next) {
        try {
            const parentCommentId = parseInt(req.params.commentId);
            const userId = req.userId;
            const limit = parseInt(req.query.limit) || 20;
            const offset = parseInt(req.query.offset) || 0;

            // 驗證父留言是否存在
            const commentExists = await commentService.commentExists(parentCommentId);
            if (!commentExists) {
                return res.status(404).json({
                    ok: false,
                    error: '找不到該留言'
                });
            }

            const replies = await commentService.getRepliesByCommentId(
                parentCommentId, 
                userId,
                { limit, offset }
            );

            res.json({
                ok: true,
                data: replies,
                pagination: {
                    limit,
                    offset
                }
            });

        } catch (error) {
            console.error('[getRepliesByComment] 錯誤:', error);
            next(error);
        }
    }

    // 獲取單一留言
    async getCommentById(req, res, next) {
        try {
            const commentId = parseInt(req.params.id);
            const userId = req.userId;

            const comment = await commentService.getCommentById(commentId, userId);

            if (!comment) {
                return res.status(404).json({
                    ok: false,
                    error: '找不到該留言'
                });
            }

            res.json({
                ok: true,
                data: comment
            });

        } catch (error) {
            console.error('[getCommentById] 錯誤:', error);
            next(error);
        }
    }

    // 刪除留言
    async deleteComment(req, res, next) {
        try {
            const commentId = parseInt(req.params.id);
            const userId = req.userId;

            const result = await commentService.deleteComment(commentId, userId, req.isAdmin);

            if (!result) {
                return res.status(404).json({
                    ok: false,
                    error: '找不到該留言或無權限刪除'
                });
            }

            res.json({
                ok: true,
                message: '留言已刪除'
            });

        } catch (error) {
            console.error('[deleteComment] 錯誤:', error);
            next(error);
        }
    }

    // 管理員刪除留言（先解決檢舉，再刪除內容）
    async adminDeleteComment(req, res) {
        try {
            if (!req.isAdmin) return res.status(403).json({ ok: false, error: '權限不足' });
            const commentId = parseInt(req.params.id);
            const postService = require('../services/postservice');
            await postService.resolveCommentReports(commentId);
            const result = await commentService.deleteComment(commentId, req.userId, true);
            if (!result) return res.status(404).json({ ok: false, error: '找不到該留言' });
            res.json({ ok: true, message: '留言已刪除' });
        } catch (error) {
            console.error('[adminDeleteComment] 錯誤:', error);
            res.status(500).json({ ok: false, error: error.message });
        }
    }
}

module.exports = new CommentController();