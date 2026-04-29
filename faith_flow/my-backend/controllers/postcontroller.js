// controllers/postController.js
const postService = require('../services/postservice');

class PostController {
    // 新增貼文

async createPost(req, res, next) {
        console.log('========================================');
        console.log('📝 [postController.createPost] 開始處理');
        console.log('========================================');
        
        try {
            console.log('📥 Request body:', JSON.stringify(req.body, null, 2));
            console.log('👤 User ID:', req.userId);
            console.log('👤 User info:', req.user);

            const postData = {
                author_user_id: req.userId,
                post_text: req.body.post_text,
                post_type: req.body.post_type,
                visibility: req.body.visibility,
                letter_id: req.body.letter_id,
                diary_id: req.body.diary_id,
                tags: req.body.tags
            };

            console.log('📦 準備的貼文資料:', JSON.stringify(postData, null, 2));

            // 驗證
            if (postData.post_type === 'letter' && !postData.letter_id) {
                console.log('❌ 驗證失敗：letter 類型缺少 letter_id');
                return res.status(400).json({ 
                    ok: false,
                    error: 'letter 類型貼文必須提供 letter_id' 
                });
            }

            if (postData.post_type === 'diary' && !postData.diary_id) {
                console.log('❌ 驗證失敗：diary 類型缺少 diary_id');
                return res.status(400).json({ 
                    ok: false,
                    error: 'diary 類型貼文必須提供 diary_id' 
                });
            }

            console.log('✅ 驗證通過，準備調用 postService.createPost...');
            const post = await postService.createPost(postData);
            console.log('✅ postService.createPost 完成！');
            console.log('📄 返回的貼文資料:', JSON.stringify(post, null, 2));

            const response = {
                ok: true,
                message: '貼文發布成功',
                data: post
            };

            console.log('📤 發送響應:', JSON.stringify(response, null, 2));
            res.status(201).json(response);
            console.log('✅ 響應已發送');
            console.log('========================================');

        } catch (error) {
            console.error('========================================');
            console.error('❌ [postController.createPost] 發生錯誤:');
            console.error('錯誤訊息:', error.message);
            console.error('錯誤堆疊:', error.stack);
            console.error('========================================');
            next(error);
        }
    }

    // async createPost(req, res, next) {
    //     try {
    //         // req.userId 是從 attachUserId middleware 來的 int
    //         const postData = {
    //             author_user_id: req.userId,  // ⭐ 使用 int userID
    //             post_text: req.body.post_text,
    //             post_type: req.body.post_type,
    //             visibility: req.body.visibility,
    //             letter_id: req.body.letter_id,
    //             diary_id: req.body.diary_id,
    //             tags: req.body.tags
    //         };

    //         // 驗證：letter/diary 類型必須提供對應的 ID
    //         if (postData.post_type === 'letter' && !postData.letter_id) {
    //             return res.status(400).json({ 
    //                 ok: false,
    //                 error: 'letter 類型貼文必須提供 letter_id' 
    //             });
    //         }

    //         if (postData.post_type === 'diary' && !postData.diary_id) {
    //             return res.status(400).json({ 
    //                 ok: false,
    //                 error: 'diary 類型貼文必須提供 diary_id' 
    //             });
    //         }

    //         const post = await postService.createPost(postData);

    //         res.status(201).json({
    //             ok: true,
    //             message: '貼文發布成功',
    //             data: post
    //         });

    //     } catch (error) {
    //         console.error('[createPost] 錯誤:', error);
    //         next(error);
    //     }
    // }

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

    // 更新貼文
    async updatePost(req, res, next) {
        try {
            const postId = parseInt(req.params.id);
            const userId = req.userId;
            const { post_text, visibility, tags } = req.body;

            const post = await postService.updatePost(postId, userId, { post_text, visibility, tags });

            if (!post) {
                return res.status(404).json({ ok: false, error: '找不到該貼文或無權限編輯' });
            }

            res.json({ ok: true, message: '貼文已更新', data: post });
        } catch (error) {
            console.error('[updatePost] 錯誤:', error);
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