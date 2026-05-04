// controllers/postController.js
const postService = require('../services/postservice');
const cloudflareService = require('../services/cloudflareservice');

class PostController {
    // ⭐ 新增貼文（支援圖片上傳）
    async createPost(req, res, next) {
        console.log('========================================');
        console.log('📝 [postController.createPost] 開始處理');
        console.log('========================================');
        
        try {
            console.log('📥 Request body:', JSON.stringify(req.body, null, 2));
            console.log('👤 User ID:', req.userId);
            console.log('👤 User info:', req.user);
            console.log('📷 上傳的檔案:', req.file);

            let tags = req.body.tags;
            if (typeof tags === 'string') {
                try { tags = JSON.parse(tags); } catch { tags = undefined; }
            }

            const postData = {
                author_user_id: req.userId,
                post_text: req.body.post_text,
                post_type: req.body.post_type,
                visibility: req.body.visibility,
                letter_id: req.body.letter_id,
                diary_id: req.body.diary_id,
                summary_id: req.body.summary_id,
                tags
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

            if (postData.post_type === 'summary' && !postData.summary_id) {
                console.log('❌ 驗證失敗：summary 類型缺少 summary_id');
                return res.status(400).json({
                    ok: false,
                    error: 'summary 類型貼文必須提供 summary_id'
                });
            }

            // ⭐ 驗證圖片檔案（如果有上傳）
            if (req.file) {
                const validation = cloudflareService.validateImageFile(req.file);
                if (!validation.valid) {
                    console.log('❌ 圖片驗證失敗:', validation.error);
                    return res.status(400).json({
                        ok: false,
                        error: validation.error
                    });
                }
                console.log('✅ 圖片驗證通過');
            }

            console.log('✅ 驗證通過，準備調用 postService.createPost...');
            
            // ⭐ 傳遞圖片檔案給 service
            const post = await postService.createPost(postData, req.file);
            
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

    // ⭐ 更新貼文（支援圖片更換）
    async updatePost(req, res, next) {
        try {
            const postId = parseInt(req.params.id);
            const userId = req.userId;
            const { post_text, visibility, tags } = req.body;

            // ⭐ 驗證圖片檔案（如果有上傳新圖片）
            if (req.file) {
                const validation = cloudflareService.validateImageFile(req.file);
                if (!validation.valid) {
                    return res.status(400).json({
                        ok: false,
                        error: validation.error
                    });
                }
            }

            // ⭐ 傳遞新圖片（如果有）
            const post = await postService.updatePost(
                postId, 
                userId, 
                { post_text, visibility, tags },
                req.file  // 新圖片檔案
            );

            if (!post) {
                return res.status(404).json({ 
                    ok: false, 
                    error: '找不到該貼文或無權限編輯' 
                });
            }

            res.json({ 
                ok: true, 
                message: '貼文已更新', 
                data: post 
            });

        } catch (error) {
            console.error('[updatePost] 錯誤:', error);
            next(error);
        }
    }

    // 刪除貼文（會自動刪除 R2 上的圖片）
    async deletePost(req, res, next) {
        try {
            const postId = parseInt(req.params.id);
            const userId = req.userId;

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
                user_id: req.userId,
                post_type: req.query.post_type,
                tag: req.query.tag,
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
            console.error('[getMyPosts] 錯誤:', error);
            next(error);
        }
    }
}

module.exports = new PostController();