const conversationService = require('../services/conversationservice');
const magisteriumService = require('../services/magisteriumservice');

class MessageController {
    async list(req, res, next) {
        try {
            const { conversation_id } = req.params;
            const { limit, before_id } = req.query;

            const messages = await conversationService.getMessages(
                conversation_id,
                limit ? parseInt(limit) : 50,
                before_id ? parseInt(before_id) : null
            );

            res.json({
                success: true,
                data: messages,
                total: messages.length
            });
        } catch (error) {
            next(error);
        }
    }

    async send(req, res, next) {
        try {
            const { conversation_id } = req.params;
            const { content, user_id } = req.body;
            const firebaseToken = req.headers.authorization?.split('Bearer ')[1];

            if (!content || !user_id) {
                return res.status(400).json({
                    success: false,
                    error: 'content 和 user_id 為必填欄位'
                });
            }

            // 1. 檢查對話是否存在
            const conversation = await conversationService.getConversation(conversation_id);
            if (!conversation) {
                return res.status(404).json({
                    success: false,
                    error: '對話不存在'
                });
            }

            // 2. 儲存用戶訊息
            const userMessage = await conversationService.addMessage(
                conversation_id,
                'user',
                content
            );

            let aiResponse;
            let assistantContent;
            let metadata = {};

            // 3. 呼叫 Magisterium API（yoda 和 quanyuan 都用這個）
            try {
                aiResponse = await magisteriumService.chat(content, firebaseToken);
                
                // 組合回應內容
                assistantContent = '';
                if (aiResponse.companion_response) {
                    assistantContent += `💙 陪伴回應：\n${aiResponse.companion_response}\n\n`;
                }
                if (aiResponse.knowledge_answer) {
                    assistantContent += `📖 知識回答：\n${aiResponse.knowledge_answer}`;
                }

                // 將結構化資料存入 metadata
                metadata = {
                    source: conversation.source,
                    knowledge_answer: aiResponse.knowledge_answer,
                    companion_response: aiResponse.companion_response,
                    citations: aiResponse.citations,
                };
            } catch (error) {
                console.error('Magisterium API Error:', error);
                assistantContent = '抱歉，系統暫時無法回應，請稍後再試。';
                metadata = {
                    source: conversation.source,
                    error: error.message,
                };
            }

            // 4. 儲存 AI 回覆
            const assistantMessage = await conversationService.addMessage(
                conversation_id,
                'assistant',
                assistantContent,
                userMessage.message_id,
                metadata
            );

            // 5. 如果是第一則訊息，自動生成標題
            const history = await conversationService.getMessages(conversation_id, 1);
            if (history.length === 1 && (!conversation.title || conversation.title === '新對話')) {
                const title = magisteriumService.generateTitle(content);
                await conversationService.updateTitle(conversation_id, title);
            }

            // 6. 更新對話時間
            await conversationService.touch(conversation_id);

            // 7. 回傳給前端（相容 index.tsx 的格式）
            res.json({
                ok: true,
                success: true,
                data: {
                    user_message: {
                        message_id: userMessage.message_id,
                        content: userMessage.ms_content,
                        created_at: userMessage.created_at
                    },
                    assistant_message: {
                        message_id: assistantMessage.message_id,
                        content: assistantMessage.ms_content,
                        created_at: assistantMessage.created_at
                    },
                    knowledge_answer: aiResponse?.knowledge_answer,
                    companion_response: aiResponse?.companion_response,
                    citations: aiResponse?.citations || [],
                }
            });
        } catch (error) {
            console.error('Send message error:', error);
            res.status(500).json({
                ok: false,
                success: false,
                error: error.message
            });
        }
    }

    async delete(req, res, next) {
        try {
            const { id } = req.params;
            await conversationService.deleteMessage(id);
            res.json({
                success: true,
                message: '訊息已刪除'
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new MessageController();