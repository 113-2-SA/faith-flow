// services/shareService.js
const pool = require('../config/database');

class ShareService {
    // 轉發貼文到自己的版面
    async sharePost(shareData) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // 檢查原始貼文是否存在
            const originalPostQuery = `
                SELECT * FROM community_posts 
                WHERE community_post_id = $1 AND deleted_at IS NULL
            `;
            
            const originalPostResult = await client.query(originalPostQuery, [shareData.original_post_id]);
            
            if (originalPostResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return { success: false, error: '找不到原始貼文' };
            }

            const originalPost = originalPostResult.rows[0];

            // 創建新的轉發貼文
            const newPostQuery = `
                INSERT INTO community_posts 
                (author_user_id, post_text, post_type, visibility)
                VALUES ($1, $2, 'shared', $3)
                RETURNING *
            `;

            const postText = shareData.share_caption 
                ? shareData.share_caption 
                : `轉發了這篇貼文`;

            const newPostResult = await client.query(newPostQuery, [
                shareData.shared_by_user_id,
                postText,
                shareData.visibility || 'public'
            ]);

            const newPost = newPostResult.rows[0];

            // 記錄轉發關係
            const shareRecordQuery = `
                INSERT INTO community_post_shares 
                (original_post_id, shared_by_user_id, shared_post_id, share_caption)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;

            const shareRecordResult = await client.query(shareRecordQuery, [
                shareData.original_post_id,
                shareData.shared_by_user_id,
                newPost.community_post_id,
                shareData.share_caption
            ]);

            // 更新原始貼文的轉發數
            await client.query(`
                UPDATE community_posts
                SET share_count = share_count + 1
                WHERE community_post_id = $1
            `, [shareData.original_post_id]);

            await client.query('COMMIT');

            // 返回完整的轉發資訊
            return {
                success: true,
                message: '轉發成功',
                data: {
                    share: shareRecordResult.rows[0],
                    new_post: newPost,
                    original_post: originalPost
                }
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // 取消轉發（刪除轉發的貼文）
    async unsharePost(shareId, userId) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // 查詢轉發記錄
            const shareQuery = `
                SELECT * FROM community_post_shares 
                WHERE share_id = $1 
                AND shared_by_user_id = $2 
                AND deleted_at IS NULL
            `;
            
            const shareResult = await client.query(shareQuery, [shareId, userId]);
            
            if (shareResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return { success: false, error: '找不到轉發記錄或無權限' };
            }

            const share = shareResult.rows[0];

            // 軟刪除轉發記錄
            await client.query(`
                UPDATE community_post_shares 
                SET deleted_at = CURRENT_TIMESTAMP
                WHERE share_id = $1
            `, [shareId]);

            // 軟刪除轉發的貼文
            if (share.shared_post_id) {
                await client.query(`
                    UPDATE community_posts 
                    SET deleted_at = CURRENT_TIMESTAMP
                    WHERE community_post_id = $1
                `, [share.shared_post_id]);
            }

            // 更新原始貼文的轉發數
            await client.query(`
                UPDATE community_posts
                SET share_count = GREATEST(share_count - 1, 0)
                WHERE community_post_id = $1
            `, [share.original_post_id]);

            await client.query('COMMIT');

            return { success: true, message: '取消轉發成功' };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // 獲取貼文的轉發列表
    async getPostShares(postId, options = {}) {
        const { limit = 50, offset = 0 } = options;

        const query = `
            SELECT 
                s.*,
                u."userName" as username,
                u."userPhoto" as avatar_url
            FROM community_post_shares s
            LEFT JOIN "user" u ON s.shared_by_user_id = u."userID"
            WHERE s.original_post_id = $1 
            AND s.deleted_at IS NULL
            ORDER BY s.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [postId, limit, offset]);
        return result.rows;
    }

    // 獲取貼文的轉發總數
    async getPostSharesCount(postId) {
        const query = `
            SELECT share_count
            FROM community_posts
            WHERE community_post_id = $1
        `;
        
        const result = await pool.query(query, [postId]);
        return result.rows[0]?.share_count || 0;
    }

    // 檢查使用者是否已轉發
    async hasUserShared(postId, userId) {
        const query = `
            SELECT share_id 
            FROM community_post_shares 
            WHERE original_post_id = $1 
            AND shared_by_user_id = $2 
            AND deleted_at IS NULL
        `;
        
        const result = await pool.query(query, [postId, userId]);
        return result.rows.length > 0;
    }

    // 獲取轉發的原始貼文資訊
    async getOriginalPost(sharedPostId) {
        const query = `
            SELECT 
                p.*,
                u."userName" as original_author_name,
                u."userPhoto" as original_author_avatar
            FROM community_post_shares s
            JOIN community_posts p ON s.original_post_id = p.community_post_id
            LEFT JOIN "user" u ON p.author_user_id = u."userID"
            WHERE s.shared_post_id = $1 
            AND s.deleted_at IS NULL
            AND p.deleted_at IS NULL
        `;

        const result = await pool.query(query, [sharedPostId]);
        return result.rows[0];
    }
}

module.exports = new ShareService();