// routes/chat.js
// 有答大師 HTTP 路由層（只處理請求/回應，業務邏輯在 services）

const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const attachUserId = require("../middleware/attachuserId");
const pool = require("../config/database");
const mcp = require("../services/magisteriumMcp");
const { callGroqStreamResponse, callOllama, callLLM } = require("../services/llmService");
const {
  SOURCE_TIER,
  getOrCreateConversation,
  saveMessage,
  getUserProfile,
  generateAutoTitle,
  retrieverAgent,
  answererAgent,
  analyzeEmotion,
  getTokenConfig,
  deduplicateCitations,
  getDiaryContext,
} = require("../services/chatAgentService");

// POST /api/chat/send
router.post("/send", verifyToken, attachUserId, async (req, res) => {
  const { message, conversationId, quoted_content, quoted_type } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ ok: false, error: "message 欄位不得為空" });
  }

  const query = message.trim();
  const userId = req.userId;

  try {
    const userProfile = await getUserProfile(userId);
    console.log("[Chat/send] userProfile:", userProfile ? `"${userProfile.slice(0, 40)}..."` : "(empty)");

    const convId = await getOrCreateConversation(userId, conversationId);

    await saveMessage({
      conversationId: convId,
      role: "user",
      content: query,
      companionResponse: null,
      citations: quoted_content ? [{ quoted_type, quoted_content }] : [],
    });

    const [newEmotionScore] = await Promise.allSettled([analyzeEmotion(query)]);
    const emotionScore = newEmotionScore.status === "fulfilled" ? newEmotionScore.value : 50;
    const { companionMaxTokens, knowledgeMaxTokens, companionTone } = getTokenConfig(emotionScore);
    console.log(`[Send] 情緒分析完成: ${emotionScore}，tone: ${companionTone}`);

    const evidence = await retrieverAgent(query);
    const { knowledgeAnswer, companionResponse, citations } = await answererAgent(
      query, quoted_content, quoted_type,
      { knowledgeMaxTokens, companionMaxTokens, companionTone, userProfile }
    );

    await saveMessage({
      conversationId: convId,
      role: "assistant",
      content: knowledgeAnswer,
      companionResponse,
      citations,
    });

    return res.json({
      ok: true,
      data: {
        conversationId: convId,
        query,
        knowledge_answer: knowledgeAnswer,
        companion_response: companionResponse,
        citations,
        emotion_score: emotionScore,
        meta: {
          retriever_count: evidence.results.length,
          citations_count: citations.length,
          answer_tier: SOURCE_TIER.MAGISTERIUM,
          has_quote: !!quoted_content,
        },
      },
    });
  } catch (err) {
    console.error("[POST /api/chat/send] failed:", err.message);
    return res.status(500).json({
      ok: false,
      error: "有答大師暫時無法回應，請稍後再試",
      detail: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

// GET /api/chat/history
router.get("/history", verifyToken, attachUserId, async (req, res) => {
  const userId = req.userId;
  try {
    const conversations = await pool.query(
      `SELECT conversation_id, title, created_at, updated_at, status
       FROM conversations
       WHERE user_id = $1 AND deleted_at IS NULL AND con_from IS NULL
       ORDER BY updated_at DESC
       LIMIT 20`,
      [userId]
    );
    return res.json({ ok: true, data: conversations.rows });
  } catch (err) {
    console.error("[GET /api/chat/history] failed:", err.message);
    return res.status(500).json({ ok: false, error: "取得對話歷史失敗" });
  }
});

// POST /api/chat/conversations
router.post("/conversations", verifyToken, attachUserId, async (req, res) => {
  const userId = req.userId;
  try {
    const result = await pool.query(
      `INSERT INTO conversations (user_id, title, status, created_at, updated_at)
       VALUES ($1, '新對話', 'active', NOW(), NOW())
       RETURNING conversation_id, title, created_at`,
      [userId]
    );
    return res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("[POST /conversations] failed:", err.message);
    return res.status(500).json({ ok: false, error: "建立對話失敗" });
  }
});

// POST /api/chat/stream（SSE 串流版）
router.post("/stream", verifyToken, attachUserId, async (req, res) => {
  const { message, conversationId, quoted_content, quoted_type } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ ok: false, error: "message 欄位不得為空" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const query = message.trim();
  const userId = req.userId;

  try {
    const userProfile = await getUserProfile(userId);
    console.log("[Chat/stream] userProfile:", userProfile ? `"${userProfile.slice(0, 40)}..."` : "(empty)");

    const convId = await getOrCreateConversation(userId, conversationId);
    send({ type: "start", conversationId: convId });

    await saveMessage({
      conversationId: convId,
      role: "user",
      content: query,
      companionResponse: null,
      citations: quoted_content ? [{ quoted_type, quoted_content }] : [],
    });

    // 情緒分析 + 自動標題 + 日記 RAG 並行
    const [newEmotionScore, autoTitleResult, diaryContextResult] = await Promise.allSettled([
      analyzeEmotion(query),
      generateAutoTitle(convId, query).then((title) => {
        if (title) send({ type: "title", title });
        return title;
      }),
      getDiaryContext(userId, query),
    ]);

    const thisEmotionScore = newEmotionScore.status === "fulfilled" ? newEmotionScore.value : 50;
    const { companionMaxTokens, knowledgeMaxTokens, companionTone } = getTokenConfig(thisEmotionScore);
    const diaryContext = diaryContextResult.status === "fulfilled" ? diaryContextResult.value : "";
    const profileContext = userProfile
      ? `【使用者自我介紹】${userProfile}\n若使用者自述年資則以其說法為準；否則依敘述推估：5年以下為資淺、6~10年為較資深、10年以上為資深。\n`
      : "";

    console.log(`[Stream] 情緒: ${thisEmotionScore}，tone: ${companionTone}，knowledge: ${knowledgeMaxTokens}, companion: ${companionMaxTokens}`);

    // Magisterium 搜尋（結果忽略，mcp.chat 為主要資料來源）
    await retrieverAgent(query);
    const chatResult = await mcp.chat(query);
    const rawAnswer = chatResult?.answer || "";
    const magisteriumCitations = chatResult?.citations || [];

    const quoteLabel = quoted_type === "knowledge" ? "知識回答" : "陪伴回應";
    const quoteContext = quoted_content
      ? `\n\n[使用者引用的${quoteLabel}]：\n${quoted_content}\n\n請特別針對使用者引用的這段內容來回答。`
      : "";

    const knowledgeSystemPrompt = `你是「有答大師」，一個天主教信仰助理。
你的任務是將 Magisterium AI 提供的英文神學回答，整理成簡潔、易懂的繁體中文。

${profileContext}規則：
1. 只能根據提供的資料回答，不可自行添加未經引用的內容
2. 不需要在回覆中標註引用來源，來源已另外顯示
3. 【重要】回覆總字數限制在100字以內，簡潔扼要
4. 語氣要溫和、尊重，適合信仰探討；資淺者多用生活化比喻，較資深／資深者可適度使用神學術語
5. 如果資料不足以回答問題，誠實用一句話說明
6. 【重要】請只使用繁體中文，絕對不得使用簡體字`;

    const knowledgeUserMessage = `使用者的問題：${query}${quoteContext}${diaryContext}

Magisterium AI 的回答（請整理成繁體中文）：
${rawAnswer}`;

    // 串流輸出知識回答
    let knowledgeAnswer = "";
    const streamRes = await callGroqStreamResponse(knowledgeSystemPrompt, knowledgeUserMessage, {
      temperature: 0.3,
      max_tokens: knowledgeMaxTokens,
    });

    if (streamRes) {
      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const chunk = line.slice(6).trim();
          if (chunk === "[DONE]") continue;
          try {
            const parsed = JSON.parse(chunk);
            const text = parsed.choices?.[0]?.delta?.content || "";
            if (text) {
              knowledgeAnswer += text;
              send({ type: "knowledge_chunk", text });
            }
          } catch { /* skip malformed chunk */ }
        }
      }
    } else {
      knowledgeAnswer = await callOllama(knowledgeSystemPrompt, knowledgeUserMessage, {
        temperature: 0.3,
        max_tokens: knowledgeMaxTokens,
      });
      send({ type: "knowledge_chunk", text: knowledgeAnswer });
    }

    // 陪伴回應
    const toneInstruction =
      companionTone === "HIGH_EMOTION"
        ? "使用者情緒低落，需要大量情感支持，請給予4-5句溫暖安慰的話。"
        : companionTone === "BALANCED"
        ? "使用者情緒平穩，請給予2-3句適度的情感支持。"
        : "使用者主要想探索知識，陪伴回應請簡短，1-2句話即可。";

    const companionSystemPrompt = `你是「有答大師」的陪伴模式，一個溫暖的天主教信仰陪伴者。
你的任務是針對使用者的問題，提供簡短、溫暖、具同理心的回應。

規則：
1. 不可冒充神父或提供靈修指導
2. 不可給出神學判斷或道德裁決
3. 只能提供情感支持和引導式提問
4. 語氣要像一個關心的朋友
5. 結尾提供一個引導式問題，邀請使用者繼續探索
6. 【重要】回覆總字數限制在100字以內，簡潔有力
7. 【重要】請只使用繁體中文，絕對不得使用簡體字
8. ${toneInstruction}${profileContext ? `\n9. ${profileContext}依信仰資歷調整語氣：資淺者多鼓勵引導、較資深者平等分享、資深者可共同深思。` : ""}`;

    const companionUserMessage = `使用者的問題：${query}${quoteContext}

請給出溫暖的情感陪伴回應（不要重複知識回答的內容）：`;

    let companionResponse = null;
    try {
      companionResponse = await callLLM(companionSystemPrompt, companionUserMessage, {
        temperature: 0.8,
        max_tokens: companionMaxTokens,
      });
    } catch (err) {
      console.warn("[Stream] companion failed:", err.message);
    }

    const citations = deduplicateCitations(magisteriumCitations);

    await saveMessage({
      conversationId: convId,
      role: "assistant",
      content: knowledgeAnswer,
      companionResponse,
      citations,
    });

    send({ type: "companion", text: companionResponse });
    send({ type: "citations", data: citations });
    send({ type: "emotion", score: thisEmotionScore });
    send({ type: "done", conversationId: convId });
    res.end();
  } catch (err) {
    console.error("[POST /api/chat/stream] failed:", err.message);
    send({ type: "error", message: "有答大師暫時無法回應，請稍後再試" });
    res.end();
  }
});

// GET /api/chat/:conversationId/messages
router.get("/:conversationId/messages", verifyToken, attachUserId, async (req, res) => {
  const userId = req.userId;
  const { conversationId } = req.params;
  try {
    const conv = await pool.query(
      `SELECT conversation_id FROM conversations
       WHERE conversation_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [conversationId, userId]
    );
    if (conv.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "對話不存在" });
    }
    const messages = await pool.query(
      `SELECT message_id, ms_role, ms_content, metadata, created_at
       FROM messages
       WHERE conversation_id = $1 AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      [conversationId]
    );
    const formattedMessages = messages.rows.map((msg) => {
      const meta =
        typeof msg.metadata === "string"
          ? (() => { try { return JSON.parse(msg.metadata); } catch { return {}; } })()
          : msg.metadata || {};
      return {
        message_id: msg.message_id,
        role: msg.ms_role,
        content: msg.ms_content,
        companion_response: meta.companion_response || null,
        citations: meta.citations || [],
        created_at: msg.created_at,
      };
    });
    return res.json({ ok: true, data: formattedMessages });
  } catch (err) {
    console.error("[GET messages] failed:", err.message);
    return res.status(500).json({ ok: false, error: "取得訊息失敗" });
  }
});

// PATCH /api/chat/:conversationId/title
router.patch("/:conversationId/title", verifyToken, attachUserId, async (req, res) => {
  const userId = req.userId;
  const { conversationId } = req.params;
  const { title } = req.body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ ok: false, error: "title 欄位不得為空" });
  }

  try {
    const result = await pool.query(
      `UPDATE conversations
       SET title = $1, updated_at = NOW()
       WHERE conversation_id = $2 AND user_id = $3 AND deleted_at IS NULL
       RETURNING conversation_id, title`,
      [title.trim(), conversationId, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "對話不存在" });
    }
    return res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("[PATCH title] failed:", err.message);
    return res.status(500).json({ ok: false, error: "修改標題失敗" });
  }
});

// DELETE /api/chat/:conversationId
router.delete("/:conversationId", verifyToken, attachUserId, async (req, res) => {
  const userId = req.userId;
  const { conversationId } = req.params;

  try {
    const result = await pool.query(
      `UPDATE conversations
       SET deleted_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING conversation_id`,
      [conversationId, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "對話不存在" });
    }
    return res.json({ ok: true, data: { conversation_id: conversationId } });
  } catch (err) {
    console.error("[DELETE conversation] failed:", err.message);
    return res.status(500).json({ ok: false, error: "刪除對話失敗" });
  }
});

// POST /api/chat/test-send（開發測試用）
router.post("/test-send", async (req, res) => {
  const { message, quoted_content, quoted_type } = req.body;
  if (!message) return res.status(400).json({ ok: false, error: "message 必填" });
  try {
    const evidence = await retrieverAgent(message);
    const { knowledgeAnswer, companionResponse, citations } = await answererAgent(
      message, quoted_content, quoted_type
    );
    return res.json({
      ok: true,
      data: {
        query: message,
        knowledge_answer: knowledgeAnswer,
        companion_response: companionResponse,
        citations,
        meta: {
          retriever_count: evidence.results.length,
          citations_count: citations.length,
          has_quote: !!quoted_content,
        },
      },
    });
  } catch (err) {
    console.error("[test-send] failed:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
