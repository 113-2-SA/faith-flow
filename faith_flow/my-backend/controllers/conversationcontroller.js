const conversationService = require('../services/conversationservice');

class ConversationController {
    /**
     * 建立新對話
     * POST /api/conversations
     * Body: { user_id, source, title? }
     */
    async create(req, res, next) {
        try {
            const { user_id, source, title } = req.body;

            if (!user_id) {
                return res.status(400).json({
                    success: false,
                    error: 'user_id 為必填欄位'
                });
            }

            if (!source || !['yoda', 'quanyuan'].includes(source)) {
                return res.status(400).json({
                    success: false,
                    error: 'source 必須是 yoda 或 quanyuan'
                });
            }

            const conversation = await conversationService.createConversation(
                user_id, 
                source, 
                title
            );

            res.status(201).json({
                success: true,
                data: conversation
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * 取得用戶的對話列表
     * GET /api/conversations?user_id=123&source=yoda
     */
    async list(req, res, next) {
        try {
            const { user_id, source, limit } = req.query;

            if (!user_id) {
                return res.status(400).json({
                    success: false,
                    error: 'user_id 為必填參數'
                });
            }

            // 驗證 source（如果有提供）
            if (source && !['yoda', 'quanyuan'].includes(source)) {
                return res.status(400).json({
                    success: false,
                    error: 'source 必須是 yoda 或 quanyuan'
                });
            }

            const conversations = await conversationService.getUserConversations(
                parseInt(user_id),
                source || null,  // 可選過濾
                limit ? parseInt(limit) : 50
            );

            res.json({
                success: true,
                data: conversations,
                total: conversations.length,
                filter: { source: source || 'all' }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * 取得單一對話
     * GET /api/conversations/:id
     */
    async getOne(req, res, next) {
        try {
            const { id } = req.params;

            const conversation = await conversationService.getConversation(id);

            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    error: '對話不存在'
                });
            }

            res.json({
                success: true,
                data: conversation
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * 更新對話標題
     * PATCH /api/conversations/:id
     */
    async update(req, res, next) {
        try {
            const { id } = req.params;
            const { title } = req.body;

            if (!title) {
                return res.status(400).json({
                    success: false,
                    error: 'title 為必填欄位'
                });
            }

            const updated = await conversationService.updateTitle(id, title);

            if (!updated) {
                return res.status(404).json({
                    success: false,
                    error: '對話不存在'
                });
            }

            res.json({
                success: true,
                data: updated
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * 刪除對話
     * DELETE /api/conversations/:id
     */
    async delete(req, res, next) {
        try {
            const { id } = req.params;

            await conversationService.deleteConversation(id);

            res.json({
                success: true,
                message: '對話已刪除'
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * 🆕 取得對話統計（依 source 分類）
     * GET /api/conversations/stats?user_id=123
     */
    async stats(req, res, next) {
        try {
            const { user_id } = req.query;

            if (!user_id) {
                return res.status(400).json({
                    success: false,
                    error: 'user_id 為必填參數'
                });
            }

            const stats = await conversationService.getStatsBySource(parseInt(user_id));

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ConversationController();