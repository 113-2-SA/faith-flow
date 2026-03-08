// controllers/postController.js
const postService = require('../services/postservice');

class PostController {
    // 新增貼文
    async createPost(req, res, next) {
        try {
            // req.userId 是從 attachUserId middleware 來的 int
            const postData = {
                author_user_id: req.userId,  // ⭐ 使用 int userID
                post_text: req.body.post_text,
                post_type: req.body.post_type,
                visibility: req.body.visibility,
                letter_id: req.body.letter_id,
                diary_id: req.body.diary_id,
                tags: req.body.tags
            };

            // 驗證：letter/diary 類型必須提供對應的 ID
            if (postData.post_type === 'letter' && !postData.letter_id) {
                return res.status(400).json({ 
                    ok: false,
                    error: 'letter 類型貼文必須提供 letter_id' 
                });
            }

            if (postData.post_type === 'diary' && !postData.diary_id) {
                return res.status(400).json({ 
                    ok: false,
                    error: 'diary 類型貼文必須提供 diary_id' 
                });
            }

            const post = await postService.createPost(postData);

            res.status(201).json({
                ok: true,
                message: '貼文發布成功',
                data: post
            });

        } catch (error) {
            console.error('[createPost] 錯誤:', error);
            next(error);
        }
    }

    // 獲取貼文列表
    async getPosts(req, res, next) {
        try {
            const filters = {
                user_id: req.query.user_id ? parseInt(req.query.user_id) : undefined,
                post_type: req.query.post_type,
                tag: req.query.tag,
                visibility: req.query.visibility,
                limit: parseInt(req.query.limit) || 20,
                offset: parseInt(req.query.offset) || 0
            };

            const [posts, total] = await Promise.all([
                postService.getPosts(filters, req.userId),
                postService.getPostsCount(filters)
            ]);

            res.json({
                ok: true,
                data: posts,
                pagination: {
                    total,
                    limit: filters.limit,
                    offset: filters.offset,
                    hasMore: filters.offset + filters.limit < total
                }
            });

        } catch (error) {
            console.error('[getPosts] 錯誤:', error);
            next(error);
        }
    }

    // 獲取單一貼文
    async getPostById(req, res, next) {
        try {
            const postId = parseInt(req.params.id);
            const post = await postService.getPostById(postId, req.userId);

            if (!post) {
                return res.status(404).json({ 
                    ok: false,
                    error: '找不到該貼文' 
                });
            }

            res.json({
                ok: true,
                data: post
            });

        } catch (error) {
            console.error('[getPostById] 錯誤:', error);
            next(error);
        }
    }

    // 刪除貼文
    async deletePost(req, res, next) {
        try {
            const postId = parseInt(req.params.id);
            const userId = req.userId; // int userID

            const result = await postService.deletePost(postId, userId);

            if (!result) {
                return res.status(404).json({ 
                    ok: false,
                    error: '找不到該貼文或無權限刪除' 
                });
            }

            res.json({
                ok: true,
                message: '貼文已刪除'
            });

        } catch (error) {
            console.error('[deletePost] 錯誤:', error);
            next(error);
        }
    }

    // 獲取我的貼文
    async getMyPosts(req, res, next) {
        try {
            const filters = {
                user_id: req.userId,  // 當前登入使用者的 int userID
                post_type: req.query.post_type,
                tag: req.query.tag,
                limit: parseInt(req.query.limit) || 20,
                offset: parseInt(req.query.offset) || 0
            };

            const [posts, total] = await Promise.all([
                postService.getPosts(filters),
                postService.getPostsCount(filters)
            ]);

            res.json({
                ok: true,
                data: posts,
                pagination: {
                    total,
                    limit: filters.limit,
                    offset: filters.offset,
                    hasMore: filters.offset + filters.limit < total
                }
            });

        } catch (error) {
            console.error('[getMyPosts] 錯誤:', error);
            next(error);
        }
    }
}

module.exports = new PostController();