// services/postService.js
const pool = require('../config/database');


class PostService {
    // 新增貼文
    async createPost(postData) {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // 插入主貼文
            const postQuery = `
               INSERT INTO community_posts 
                (author_user_id, post_text, post_type, visibility, letter_id, diary_id, tags)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;
            
            const postResult = await client.query(postQuery, [
                postData.author_user_id,
                postData.post_text,
                postData.post_type,
                postData.visibility || 'public',
                postData.letter_id || null,
                postData.diary_id || null,
                postData.tags || null
            ]);

            const post = postResult.rows[0];

            await client.query('COMMIT');
            
            // 返回完整的貼文資料（含標籤）
            return await this.getPostById(post.community_post_id);
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // 輕量存在確認
    async postExists(postId) {
        const result = await pool.query(
            `SELECT 1 FROM community_posts WHERE community_post_id = $1 AND deleted_at IS NULL`,
            [postId]
        );
        return result.rowCount > 0;
    }

    // ⭐ 獲取單一貼文（含標籤、作者資訊、點讚和轉發狀態）
    async getPostById(postId, userId = null) {
        const query = `
            SELECT
                p.*,
                u."user_name" as username,
                u."user_pic" as avatar_url
            FROM community_posts p
            LEFT JOIN "user" u ON p.author_user_id = u."userID"
            WHERE p.community_post_id = $1 AND p.deleted_at IS NULL
        `;
        
        const result = await pool.query(query, [postId]);
        
        if (result.rows.length === 0) {
            return null;
        }

        const post = result.rows[0];

        // ⭐ 如果提供了 userId，檢查點讚和轉發狀態
        if (userId) {
            post.is_owner = Number(post.author_user_id) === Number(userId);

            const statusQuery = `
                SELECT
                    EXISTS(
                        SELECT 1 FROM community_post_likes
                        WHERE post_id = $1 AND user_id = $2
                    ) as is_liked,
                    EXISTS(
                        SELECT 1 FROM community_post_shares
                        WHERE original_post_id = $1
                        AND shared_by_user_id = $2
                        AND deleted_at IS NULL
                    ) as has_shared
            `;

            const statusResult = await pool.query(statusQuery, [postId, userId]);
            post.is_liked = statusResult.rows[0].is_liked;
            post.has_shared = statusResult.rows[0].has_shared;
        }

        // ⭐ 如果是轉發的貼文，獲取原始貼文資訊
        if (post.post_type === 'shared') {
            const originalPostQuery = `
                SELECT
                    p.*,
                    u."user_name" as original_author_name,
                    u."user_pic" as original_author_avatar
                FROM community_post_shares s
                JOIN community_posts p ON s.original_post_id = p.community_post_id
                LEFT JOIN "user" u ON p.author_user_id = u."userID"
                WHERE s.shared_post_id = $1
                AND s.deleted_at IS NULL
                AND p.deleted_at IS NULL
            `;
            
            const originalResult = await pool.query(originalPostQuery, [postId]);
            post.original_post = originalResult.rows[0] || null;
        }

        return post;
    }

    // ⭐ 獲取貼文列表（分頁）- 優化版本，一次查詢完成
    async getPosts(filters, userId = null) {
        const { 
            user_id,
            post_type,
            tag,
            visibility,
            limit = 20, 
            offset = 0 
        } = filters;

        let conditions = ['p.deleted_at IS NULL'];
        let params = [];
        let paramIndex = 1;

        if (user_id) {
            conditions.push(`p.author_user_id = $${paramIndex}`);
            params.push(user_id);
            paramIndex++;
        }

        if (post_type) {
            conditions.push(`p.post_type = $${paramIndex}`);
            params.push(post_type);
            paramIndex++;
        }

        if (visibility) {
            conditions.push(`p.visibility = $${paramIndex}`);
            params.push(visibility);
            paramIndex++;
        }

        if (tag) {
            conditions.push(`$${paramIndex} = ANY(p.tags)`);
            params.push(tag);
            paramIndex++;
        }

        // ⭐ 如果有提供 userId，加入點讚和轉發狀態
        const userStatusFields = userId ? `
            , (p.author_user_id = $${paramIndex}) as is_owner
            , EXISTS(
                SELECT 1 FROM community_post_likes
                WHERE post_id = p.community_post_id AND user_id = $${paramIndex}
            ) as is_liked
            , EXISTS(
                SELECT 1 FROM community_post_shares
                WHERE original_post_id = p.community_post_id
                AND shared_by_user_id = $${paramIndex}
                AND deleted_at IS NULL
            ) as has_shared
        ` : '';

        if (userId) {
            params.push(userId);
            paramIndex++;
        }

        params.push(limit, offset);

        const query = `
            SELECT
                p.*,
                u."user_name" as username,
                u."user_pic" as avatar_url
                ${userStatusFields}
                , op.community_post_id   as orig_post_id
                , op.post_text           as orig_post_text
                , op.created_at          as orig_post_created_at
                , ou."user_name"         as orig_author_name
                , ou."user_pic"          as orig_author_avatar
                , ps.share_caption       as orig_share_caption
            FROM community_posts p
            LEFT JOIN "user" u ON p.author_user_id = u."userID"
            LEFT JOIN community_post_shares ps
                ON ps.shared_post_id = p.community_post_id
            LEFT JOIN community_posts op
                ON ps.original_post_id = op.community_post_id AND op.deleted_at IS NULL
            LEFT JOIN "user" ou ON op.author_user_id = ou."userID"
            WHERE ${conditions.join(' AND ')}
            ORDER BY p.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        const result = await pool.query(query, params);
        return result.rows.map(row => {
            const post = { ...row };
            if (row.post_type === 'shared' && row.orig_post_id) {
                post.original_post = {
                    community_post_id: row.orig_post_id,
                    post_text: row.orig_post_text,
                    created_at: row.orig_post_created_at,
                    original_author_name: row.orig_author_name,
                    original_author_avatar: row.orig_author_avatar,
                };
            }
            delete post.orig_post_id;
            delete post.orig_post_text;
            delete post.orig_post_created_at;
            delete post.orig_author_name;
            delete post.orig_author_avatar;
            delete post.orig_share_caption;
            return post;
        });
    }

    // 獲取貼文總數（用於分頁）
    async getPostsCount(filters) {
        const { user_id, post_type, tag, visibility } = filters;

        let conditions = ['deleted_at IS NULL'];
        let params = [];
        let paramIndex = 1;

        if (user_id) {
            conditions.push(`author_user_id = $${paramIndex}`);
            params.push(user_id);
            paramIndex++;
        }

        if (post_type) {
            conditions.push(`post_type = $${paramIndex}`);
            params.push(post_type);
            paramIndex++;
        }

        if (visibility) {
            conditions.push(`visibility = $${paramIndex}`);
            params.push(visibility);
            paramIndex++;
        }

        if (tag) {
            conditions.push(`EXISTS (
                SELECT 1 FROM post_tags pt 
                WHERE pt.community_post_id = community_posts.community_post_id 
                AND pt.tag_name = $${paramIndex}
            )`);
            params.push(tag);
            paramIndex++;
        }

        const query = `
            SELECT COUNT(*) as total
            FROM community_posts
            WHERE ${conditions.join(' AND ')}
        `;

        const result = await pool.query(query, params);
        return parseInt(result.rows[0].total);
    }

    // 刪除貼文（軟刪除）
    async deletePost(postId, userId) {
        const query = `
            UPDATE community_posts 
            SET deleted_at = CURRENT_TIMESTAMP
            WHERE community_post_id = $1 
            AND author_user_id = $2 
            AND deleted_at IS NULL
            RETURNING community_post_id
        `;
        
        const result = await pool.query(query, [postId, userId]);
        return result.rows[0];
    }

    // 更新貼文
    async updatePost(postId, userId, updateData) {
        const { post_text, visibility, tags } = updateData;
        const query = `
            UPDATE community_posts
            SET post_text = $3, visibility = $4, tags = $5
            WHERE community_post_id = $1
            AND author_user_id = $2
            AND deleted_at IS NULL
            RETURNING community_post_id
        `;
        const result = await pool.query(query, [
            postId,
            userId,
            post_text,
            visibility || 'public',
            tags || null,
        ]);
        if (!result.rows[0]) return null;
        return await this.getPostById(postId, userId);
    }

    // 驗證貼文擁有者
    async isPostOwner(postId, userId) {
        const query = `
            SELECT author_user_id 
            FROM community_posts 
            WHERE community_post_id = $1 AND deleted_at IS NULL
        `;
        
        const result = await pool.query(query, [postId]);
        
        if (result.rows.length === 0) {
            return false;
        }
        
        return result.rows[0].author_user_id === userId;
    }
}

module.exports = new PostService();