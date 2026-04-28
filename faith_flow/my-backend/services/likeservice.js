// services/likeService.js
const pool = require('../config/database');

class LikeService {
    // 點讚
    async likePost(postId, userId) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // 使用 INSERT ... ON CONFLICT DO NOTHING 來處理重複點讚
            const insertQuery = `
                INSERT INTO community_post_likes (post_id, user_id)
                VALUES ($1, $2)
                ON CONFLICT (post_id, user_id) DO NOTHING
                RETURNING post_id, user_id, created_at
            `;
            
            const insertResult = await client.query(insertQuery, [postId, userId]);
            
            // 如果沒有插入任何記錄，表示已經點讚過了
            if (insertResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return { 
                    success: false, 
                    message: '已經點讚過了',
                    isLiked: true
                };
            }

            // 更新貼文的點讚數
            await client.query(`
                UPDATE community_posts
                SET like_count = like_count + 1
                WHERE community_post_id = $1
            `, [postId]);

            await client.query('COMMIT');
            
            return { 
                success: true, 
                message: '點讚成功',
                isLiked: true,
                data: insertResult.rows[0]
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // 取消點讚
    async unlikePost(postId, userId) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // ⭐ 使用複合主鍵來刪除
            const deleteQuery = `
                DELETE FROM community_post_likes 
                WHERE post_id = $1 AND user_id = $2
                RETURNING post_id, user_id
            `;
            
            const deleteResult = await client.query(deleteQuery, [postId, userId]);
            
            if (deleteResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return { 
                    success: false, 
                    message: '尚未點讚',
                    isLiked: false
                };
            }

            // 更新貼文的點讚數
            await client.query(`
                UPDATE community_posts
                SET like_count = GREATEST(like_count - 1, 0)
                WHERE community_post_id = $1
            `, [postId]);

            await client.query('COMMIT');
            
            return { 
                success: true, 
                message: '取消點讚成功',
                isLiked: false
            };

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // 切換點讚狀態（點讚/取消點讚）
    async toggleLike(postId, userId) {
        const isLiked = await this.isPostLiked(postId, userId);
        
        if (isLiked) {
            return await this.unlikePost(postId, userId);
        } else {
            return await this.likePost(postId, userId);
        }
    }

    // 檢查使用者是否已點讚
    async isPostLiked(postId, userId) {
        const query = `
            SELECT 1
            FROM community_post_likes 
            WHERE post_id = $1 AND user_id = $2
        `;
        
        const result = await pool.query(query, [postId, userId]);
        return result.rows.length > 0;
    }

    // 獲取貼文的點讚列表
    async getPostLikes(postId, options = {}) {
        const { limit = 50, offset = 0 } = options;

        const query = `
            SELECT 
                l.post_id,
                l.user_id,
                l.created_at,
                u."userName" as username,
                u."userPhoto" as avatar_url
            FROM community_post_likes l
            LEFT JOIN "user" u ON l.user_id = u."userID"
            WHERE l.post_id = $1
            ORDER BY l.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [postId, limit, offset]);
        return result.rows;
    }

    // 獲取貼文的點讚總數
    async getPostLikesCount(postId) {
        const query = `
            SELECT like_count
            FROM community_posts
            WHERE community_post_id = $1
        `;
        
        const result = await pool.query(query, [postId]);
        return result.rows[0]?.like_count || 0;
    }

    // 批次檢查多個貼文的點讚狀態
    async getPostsLikeStatus(postIds, userId) {
        if (!postIds || postIds.length === 0) {
            return {};
        }

        const query = `
            SELECT post_id
            FROM community_post_likes
            WHERE post_id = ANY($1) AND user_id = $2
        `;

        const result = await pool.query(query, [postIds, userId]);
        
        const likedPosts = {};
        result.rows.forEach(row => {
            likedPosts[row.post_id] = true;
        });

        return likedPosts;
    }

    // ⭐ 新增：批次獲取使用者點讚的貼文列表
    async getUserLikedPosts(userId, options = {}) {
        const { limit = 50, offset = 0 } = options;

        const query = `
            SELECT 
                p.*,
                u."userName" as username,
                u."userPhoto" as avatar_url,
                l.created_at as liked_at
            FROM community_post_likes l
            JOIN community_posts p ON l.post_id = p.community_post_id
            LEFT JOIN "user" u ON p.author_user_id = u."userID"
            WHERE l.user_id = $1 AND p.deleted_at IS NULL
            ORDER BY l.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [userId, limit, offset]);
        return result.rows;
    }

    // ⭐ 新增：獲取使用者點讚的貼文總數
    async getUserLikedPostsCount(userId) {
        const query = `
            SELECT COUNT(*)::int as total
            FROM community_post_likes l
            JOIN community_posts p ON l.post_id = p.community_post_id
            WHERE l.user_id = $1 AND p.deleted_at IS NULL
        `;
        
        const result = await pool.query(query, [userId]);
        return result.rows[0]?.total || 0;
    }
}

module.exports = new LikeService();