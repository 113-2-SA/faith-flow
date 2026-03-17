const db = require('../config/database');

class ConversationService {
    /**
     * 建立新對話
     * @param {number} userId 
     * @param {string} source - 'yoda' | 'quanyuan'
     * @param {string} title 
     */
    async createConversation(userId, source = 'quanyuan', title = null) {
        // 驗證 source
        if (!['yoda', 'quanyuan'].includes(source)) {
            throw new Error('source 必須是 yoda 或 quanyuan');
        }

        const result = await db.query(`
            INSERT INTO conversations (user_id, source, title, status, created_at, updated_at)
            VALUES ($1, $2, $3, 'active', NOW(), NOW())
            RETURNING conversation_id, user_id, source, title, status, created_at
        `, [userId, source, title || '新對話']);

        return result.rows[0];
    }

    /**
     * 取得用戶的所有對話（可依 source 過濾）
     * @param {number} userId 
     * @param {string} source - 可選：'yoda' | 'quanyuan' | null（全部）
     * @param {number} limit 
     */
    async getUserConversations(userId, source = null, limit = 50) {
        let query = `
            SELECT 
                c.conversation_id,
                c.source,
                c.title,
                c.status,
                c.created_at,
                c.updated_at,
                m.ms_content as last_message,
                m.ms_role as last_message_role,
                m.created_at as last_message_time,
                COUNT(msg.message_id) as message_count
            FROM conversations c
            LEFT JOIN LATERAL (
                SELECT ms_content, ms_role, created_at
                FROM messages
                WHERE conversation_id = c.conversation_id 
                  AND deleted_at IS NULL
                ORDER BY created_at DESC
                LIMIT 1
            ) m ON true
            LEFT JOIN messages msg ON msg.conversation_id = c.conversation_id 
                AND msg.deleted_at IS NULL
            WHERE c.user_id = $1 
              AND c.deleted_at IS NULL
        `;

        const params = [userId];

        // 如果指定 source，加入過濾條件
        if (source) {
            query += ` AND c.source = $${params.length + 1}`;
            params.push(source);
        }

        query += `
            GROUP BY c.conversation_id, m.ms_content, m.ms_role, m.created_at
            ORDER BY c.updated_at DESC
            LIMIT $${params.length + 1}
        `;
        params.push(limit);

        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * 取得單一對話詳情
     */
    async getConversation(conversationId) {
        const result = await db.query(`
            SELECT * FROM conversations
            WHERE conversation_id = $1 AND deleted_at IS NULL
        `, [conversationId]);

        return result.rows[0] || null;
    }

    /**
     * 更新對話標題
     */
    async updateTitle(conversationId, title) {
        const result = await db.query(`
            UPDATE conversations 
            SET title = $1, updated_at = NOW()
            WHERE conversation_id = $2 AND deleted_at IS NULL
            RETURNING conversation_id, title, updated_at
        `, [title, conversationId]);

        return result.rows[0];
    }

    /**
     * 更新對話的 updated_at
     */
    async touch(conversationId) {
        await db.query(`
            UPDATE conversations 
            SET updated_at = NOW()
            WHERE conversation_id = $1
        `, [conversationId]);
    }

    /**
     * 軟刪除對話
     */
    async deleteConversation(conversationId) {
        await db.query(`
            UPDATE conversations 
            SET deleted_at = NOW(), status = 'deleted', ended_at = NOW()
            WHERE conversation_id = $1
        `, [conversationId]);
    }

    /**
     * 取得對話的所有訊息
     */
    async getMessages(conversationId, limit = 50, beforeId = null) {
        let query = `
            SELECT 
                message_id, 
                parent_message_id,
                ms_role, 
                ms_content, 
                metadata,
                created_at
            FROM messages
            WHERE conversation_id = $1 AND deleted_at IS NULL
        `;

        const params = [conversationId];

        if (beforeId) {
            query += ` AND message_id < $2`;
            params.push(beforeId);
        }

        query += ` ORDER BY created_at ASC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await db.query(query, params);
        return result.rows;
    }

    /**
     * 新增訊息
     */
    async addMessage(conversationId, role, content, parentMessageId = null, metadata = null) {
        const result = await db.query(`
            INSERT INTO messages (
                conversation_id, 
                parent_message_id, 
                ms_role, 
                ms_content, 
                metadata,
                created_at
            )
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING message_id, ms_role, ms_content, metadata, created_at
        `, [conversationId, parentMessageId, role, content, metadata ? JSON.stringify(metadata) : null]);

        return result.rows[0];
    }

    /**
     * 刪除訊息
     */
    async deleteMessage(messageId) {
        await db.query(`
            UPDATE messages 
            SET deleted_at = NOW()
            WHERE message_id = $1
        `, [messageId]);
    }

    /**
     * 🆕 取得各 source 的對話統計
     */
    async getStatsBySource(userId) {
        const result = await db.query(`
            SELECT 
                source,
                COUNT(*) as total_conversations,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_conversations
            FROM conversations
            WHERE user_id = $1 AND deleted_at IS NULL
            GROUP BY source
        `, [userId]);

        return result.rows;
    }
}

module.exports = new ConversationService();