// services/commentService.js
const pool = require('../config/database');

class CommentService {
    // 新增留言
    async createComment(commentData) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            const query = `
                INSERT INTO community_comments 
                (post_id, user_id, parent_comment_id, comment_content)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;
            
            const result = await client.query(query, [
                commentData.post_id,
                commentData.user_id,
                commentData.parent_comment_id || null,
                commentData.comment_content
            ]);

            // 更新貼文的留言數
            await this.updatePostCommentCount(commentData.post_id, client);

            await client.query('COMMIT');

            return await this.getCommentById(result.rows[0].comment_id);

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // 獲取單一留言（含使用者資訊和點讚狀態）
    async getCommentById(commentId, userId = null) {
        const userStatusField = userId ? `
            , EXISTS(
                SELECT 1 FROM community_comment_likes 
                WHERE comment_id = c.comment_id AND user_id = $2
            ) as is_liked
        ` : '';

        const query = `
            SELECT 
                c.*,
                u."user_name" as username,
                u."user_pic" as avatar_url
                ${userStatusField}
            FROM community_comments c
            LEFT JOIN "user" u ON c.user_id = u."userID"
            WHERE c.comment_id = $1 AND c.deleted_at IS NULL
        `;
        
        const params = userId ? [commentId, userId] : [commentId];
        const result = await pool.query(query, params);
        return result.rows[0];
    }

    // 獲取貼文的所有留言（樹狀結構）
    async getCommentsByPostId(postId, userId = null, options = {}) {
        const { limit = 50, offset = 0 } = options;

        const userStatusField = userId ? `
            , EXISTS(
                SELECT 1 FROM community_comment_likes 
                WHERE comment_id = c.comment_id AND user_id = $4
            ) as is_liked
        ` : '';

        // 先獲取所有主留言（parent_comment_id IS NULL）
        const mainCommentsQuery = `
            SELECT 
                c.*,
                u."user_name" as username,
                u."user_pic" as avatar_url,
                (
                    SELECT COUNT(*)::int 
                    FROM community_comments replies 
                    WHERE replies.parent_comment_id = c.comment_id 
                    AND replies.deleted_at IS NULL
                ) as reply_count
                ${userStatusField}
            FROM community_comments c
            LEFT JOIN "user" u ON c.user_id = u."userID"
            WHERE c.post_id = $1 
            AND c.parent_comment_id IS NULL 
            AND c.deleted_at IS NULL
            ORDER BY c.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const params = userId 
            ? [postId, limit, offset, userId]
            : [postId, limit, offset];

        const mainComments = await pool.query(mainCommentsQuery, params);

        // 為每個主留言獲取回覆
        const commentsWithReplies = await Promise.all(
            mainComments.rows.map(async (comment) => {
                if (comment.reply_count > 0) {
                    const repliesUserStatusField = userId ? `
                        , EXISTS(
                            SELECT 1 FROM community_comment_likes 
                            WHERE comment_id = c.comment_id AND user_id = $2
                        ) as is_liked
                    ` : '';

                    const repliesQuery = `
                        SELECT 
                            c.*,
                            u."user_name" as username,
                            u."user_pic" as avatar_url
                            ${repliesUserStatusField}
                        FROM community_comments c
                        LEFT JOIN "user" u ON c.user_id = u."userID"
                        WHERE c.parent_comment_id = $1 
                        AND c.deleted_at IS NULL
                        ORDER BY c.created_at ASC
                    `;
                    
                    const repliesParams = userId 
                        ? [comment.comment_id, userId]
                        : [comment.comment_id];

                    const replies = await pool.query(repliesQuery, repliesParams);
                    comment.replies = replies.rows;
                } else {
                    comment.replies = [];
                }
                
                return comment;
            })
        );

        return commentsWithReplies;
    }

    // 獲取留言的回覆列表
    async getRepliesByCommentId(parentCommentId, userId = null, options = {}) {
        const { limit = 20, offset = 0 } = options;

        const userStatusField = userId ? `
            , EXISTS(
                SELECT 1 FROM community_comment_likes 
                WHERE comment_id = c.comment_id AND user_id = $4
            ) as is_liked
        ` : '';

        const query = `
            SELECT 
                c.*,
                u."user_name" as username,
                u."user_pic" as avatar_url
                ${userStatusField}
            FROM community_comments c
            LEFT JOIN "user" u ON c.user_id = u."userID"
            WHERE c.parent_comment_id = $1 
            AND c.deleted_at IS NULL
            ORDER BY c.created_at ASC
            LIMIT $2 OFFSET $3
        `;

        const params = userId 
            ? [parentCommentId, limit, offset, userId]
            : [parentCommentId, limit, offset];

        const result = await pool.query(query, params);
        return result.rows;
    }

    // 獲取留言總數
    async getCommentsCount(postId) {
        const query = `
            SELECT COUNT(*)::int as total
            FROM community_comments
            WHERE post_id = $1 AND deleted_at IS NULL
        `;
        
        const result = await pool.query(query, [postId]);
        return result.rows[0].total;
    }

    // 刪除留言（軟刪除）
    async deleteComment(commentId, userId) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // 檢查是否為留言擁有者
            const checkQuery = `
                SELECT post_id, parent_comment_id
                FROM community_comments
                WHERE comment_id = $1 
                AND user_id = $2 
                AND deleted_at IS NULL
            `;
            
            const checkResult = await client.query(checkQuery, [commentId, userId]);
            
            if (checkResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return null;
            }

            const { post_id } = checkResult.rows[0];

            // 軟刪除留言
            const deleteQuery = `
                UPDATE community_comments 
                SET deleted_at = CURRENT_TIMESTAMP
                WHERE comment_id = $1
                RETURNING comment_id
            `;
            
            const deleteResult = await client.query(deleteQuery, [commentId]);

            // 同時刪除所有回覆（如果是主留言）
            await client.query(`
                UPDATE community_comments 
                SET deleted_at = CURRENT_TIMESTAMP
                WHERE parent_comment_id = $1 AND deleted_at IS NULL
            `, [commentId]);

            // 更新貼文的留言數
            await this.updatePostCommentCount(post_id, client);

            await client.query('COMMIT');
            return deleteResult.rows[0];

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // 更新貼文的留言數
    async updatePostCommentCount(postId, client = null) {
        const queryClient = client || pool;
        
        const query = `
            UPDATE community_posts
            SET comment_count = (
                SELECT COUNT(*)
                FROM community_comments
                WHERE post_id = $1 AND deleted_at IS NULL
            )
            WHERE community_post_id = $1
        `;
        
        await queryClient.query(query, [postId]);
    }

    // 驗證留言擁有者
    async isCommentOwner(commentId, userId) {
        const query = `
            SELECT user_id 
            FROM community_comments 
            WHERE comment_id = $1 AND deleted_at IS NULL
        `;
        
        const result = await pool.query(query, [commentId]);
        
        if (result.rows.length === 0) {
            return false;
        }
        
        return result.rows[0].user_id === userId;
    }

    // 檢查貼文是否存在
    async postExists(postId) {
        const query = `
            SELECT community_post_id 
            FROM community_posts 
            WHERE community_post_id = $1 AND deleted_at IS NULL
        `;
        
        const result = await pool.query(query, [postId]);
        return result.rows.length > 0;
    }

    // 檢查父留言是否存在
    async commentExists(commentId) {
        const query = `
            SELECT comment_id 
            FROM community_comments 
            WHERE comment_id = $1 AND deleted_at IS NULL
        `;
        
        const result = await pool.query(query, [commentId]);
        return result.rows.length > 0;
    }
}

module.exports = new CommentService();