// services/commentLikeService.js
const pool = require('../config/database');

class CommentLikeService {
    // 點讚留言
    async likeComment(commentId, userId) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // 使用 INSERT ... ON CONFLICT DO NOTHING
            const insertQuery = `
                INSERT INTO community_comment_likes (comment_id, user_id)
                VALUES ($1, $2)
                ON CONFLICT (comment_id, user_id) DO NOTHING
                RETURNING comment_id, user_id, created_at
            `;
            
            const insertResult = await client.query(insertQuery, [commentId, userId]);
            
            if (insertResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return { 
                    success: false, 
                    message: '已經點讚過了',
                    isLiked: true
                };
            }

            // 更新留言的點讚數
            await client.query(`
                UPDATE community_comments
                SET like_count = like_count + 1
                WHERE comment_id = $1
            `, [commentId]);

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

    // 取消點讚留言
    async unlikeComment(commentId, userId) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const deleteQuery = `
                DELETE FROM community_comment_likes 
                WHERE comment_id = $1 AND user_id = $2
                RETURNING comment_id, user_id
            `;
            
            const deleteResult = await client.query(deleteQuery, [commentId, userId]);
            
            if (deleteResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return { 
                    success: false, 
                    message: '尚未點讚',
                    isLiked: false
                };
            }

            // 更新留言的點讚數
            await client.query(`
                UPDATE community_comments
                SET like_count = GREATEST(like_count - 1, 0)
                WHERE comment_id = $1
            `, [commentId]);

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

    // 切換點讚狀態
    async toggleLike(commentId, userId) {
        const isLiked = await this.isCommentLiked(commentId, userId);
        
        if (isLiked) {
            return await this.unlikeComment(commentId, userId);
        } else {
            return await this.likeComment(commentId, userId);
        }
    }

    // 檢查使用者是否已點讚
    async isCommentLiked(commentId, userId) {
        const query = `
            SELECT 1
            FROM community_comment_likes 
            WHERE comment_id = $1 AND user_id = $2
        `;
        
        const result = await pool.query(query, [commentId, userId]);
        return result.rows.length > 0;
    }

    // 獲取留言的點讚列表
    async getCommentLikes(commentId, options = {}) {
        const { limit = 50, offset = 0 } = options;

        const query = `
            SELECT 
                l.comment_id,
                l.user_id,
                l.created_at,
                u."userName" as username,
                u."userPhoto" as avatar_url
            FROM community_comment_likes l
            LEFT JOIN "user" u ON l.user_id = u."userID"
            WHERE l.comment_id = $1
            ORDER BY l.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [commentId, limit, offset]);
        return result.rows;
    }

    // 獲取留言的點讚總數
    async getCommentLikesCount(commentId) {
        const query = `
            SELECT like_count
            FROM community_comments
            WHERE comment_id = $1
        `;
        
        const result = await pool.query(query, [commentId]);
        return result.rows[0]?.like_count || 0;
    }
}

module.exports = new CommentLikeService();