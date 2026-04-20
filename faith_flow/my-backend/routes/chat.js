// my-backend/routes/chat.js
// POST /api/chat/send  <- 有答大師主入口
// 架構：Two-Agent Pipeline + DB儲存 + 引用回覆功能

const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const attachUserId = require("../middleware/attachuserId");
const mcp = require("../services/magisteriumMcp");
const pool = require("../config/database");

const SOURCE_TIER = {
  MAGISTERIUM: "A",
  DB_TEXT: "B",
  DIARY: "C",
  MODEL: "D",
};

// LLM 呼叫（優先 Groq，fallback Ollama）
async function callLLM(systemPrompt, userMessage, options = {}) {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey) return await callGroq(groqApiKey, systemPrompt, userMessage, options);
  return await callOllama(systemPrompt, userMessage, options);
}

// Groq 串流呼叫（回傳 fetch Response，供 SSE 使用）
async function callGroqStreamResponse(systemPrompt, userMessage, options = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1024,
      stream: true,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Groq stream failed ${res.status}: ${err.slice(0, 200)}`);
  }
  return res;
}

async function callGroq(apiKey, systemPrompt, userMessage, options = {}) {
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1024,
      stream: false,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Groq API failed ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callOllama(systemPrompt, userMessage, options = {}) {
  const baseUrl = process.env.QWEN_BASE_URL || "http://localhost:11434";
  const model = process.env.QWEN_MODEL || "qwen2.5:14b";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "faith-flow-backend/1.0" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 1024,
        stream: false,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Ollama API failed ${res.status}: ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(timeout);
  }
}

// DB：建立或取得對話
async function getOrCreateConversation(userId, conversationId) {
  if (conversationId) {
    const existing = await pool.query(
      `SELECT conversation_id FROM conversations
       WHERE conversation_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [conversationId, userId]
    );
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE conversations SET updated_at = NOW() WHERE conversation_id = $1`,
        [conversationId]
      );
      return conversationId;
    }
  }
  const result = await pool.query(
    `INSERT INTO conversations (user_id, status, created_at, updated_at)
     VALUES ($1, 'active', NOW(), NOW())
     RETURNING conversation_id`,
    [userId]
  );
  return result.rows[0].conversation_id;
}

// DB：存訊息
async function saveMessage({ conversationId, role, content, companionResponse, citations }) {
  const metadata = {
    companion_response: companionResponse || null,
    citations: citations || [],
  };
  const result = await pool.query(
    `INSERT INTO messages (conversation_id, ms_role, ms_content, metadata, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING message_id`,
    [conversationId, role, content, JSON.stringify(metadata)]
  );
  return result.rows[0].message_id;
}

// Agent 1：Retriever
async function retrieverAgent(query) {
  try {
    const searchResult = await mcp.search(query);
    return { tier: SOURCE_TIER.MAGISTERIUM, results: searchResult.results || [] };
  } catch (err) {
    console.error("[Retriever] search failed:", err.message);
    return { tier: SOURCE_TIER.MAGISTERIUM, results: [] };
  }
}

// Agent 2：Answerer
// quotedContent: 使用者引用的內容（可選）
// quotedType: 'knowledge'（知識回答）或 'companion'（陪伴回應）
async function answererAgent(query, quotedContent, quotedType) {
  const chatResult = await mcp.chat(query);
  const rawAnswer = chatResult?.answer || "";
  const magisteriumCitations = chatResult?.citations || [];

  // 有引用內容時，加進 prompt 讓 AI 針對引用內容回答
  const quoteLabel = quotedType === "knowledge" ? "知識回答" : "陪伴回應";
  const quoteContext = quotedContent
    ? `\n\n[使用者引用的${quoteLabel}]：\n${quotedContent}\n\n請特別針對使用者引用的這段內容來回答。`
    : "";

  const knowledgeSystemPrompt = `你是「有答大師」，一個天主教信仰助理。
你的任務是將 Magisterium AI 提供的英文神學回答，整理成清晰、易懂的繁體中文。

規則：
1. 只能根據提供的資料回答，不可自行添加未經引用的內容
2. 保留所有引用來源，格式為【文件名稱】
3. 使用條列式或分段方式讓回答更易讀
4. 語氣要溫和、尊重，適合信仰探討
5. 如果資料不足以回答問題，誠實說明`;

  const knowledgeUserMessage = `使用者的問題：${query}${quoteContext}

Magisterium AI 的回答（請整理成繁體中文）：
${rawAnswer}`;

  const companionSystemPrompt = `你是「有答大師」的陪伴模式，一個溫暖的天主教信仰陪伴者。
你的任務是針對使用者的問題，提供一段簡短、溫暖、具同理心的回應。

規則：
1. 不可冒充神父或提供靈修指導
2. 不可給出神學判斷或道德裁決
3. 只能提供情感支持和引導式提問
4. 語氣要像一個關心的朋友
5. 結尾可以提供一個引導式問題，邀請使用者繼續探索`;

  const companionUserMessage = `使用者的問題：${query}${quoteContext}

請給出一段溫暖的情感陪伴回應（2-3句話即可，不要重複知識回答的內容）：`;

  const knowledgeAnswer = await callLLM(
    knowledgeSystemPrompt, knowledgeUserMessage, { temperature: 0.3, max_tokens: 800 }
  );

  let companionResponse = null;
  try {
    companionResponse = await callLLM(
      companionSystemPrompt, companionUserMessage, { temperature: 0.8, max_tokens: 300 }
    );
  } catch (err) {
    console.warn("[Answerer] companion failed, skipping:", err.message);
  }

  const citations = magisteriumCitations.map((c) => ({
    tier: SOURCE_TIER.MAGISTERIUM,
    title: c.document_title || "",
    author: c.document_author || "",
    year: c.document_year || "",
    reference: c.document_reference || "",
    cited_text: c.cited_text || "",
    url: c.source_url || "",
  }));

  return { knowledgeAnswer, companionResponse, citations };
}

// POST /api/chat/send（需要 Firebase token + userId）
router.post("/send", verifyToken, attachUserId, async (req, res) => {
  // quoted_content: 使用者引用的內容（可選）
  // quoted_type: 'knowledge' 或 'companion'
  const { message, conversationId, quoted_content, quoted_type } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ ok: false, error: "message 欄位不得為空" });
  }

  const query = message.trim();
  const userId = req.userId;

  try {
    // Step 1：建立或取得對話
    const convId = await getOrCreateConversation(userId, conversationId);

    // Step 2：存使用者訊息（如果有引用，也一起記錄在 metadata）
    await saveMessage({
      conversationId: convId,
      role: "user",
      content: query,
      companionResponse: null,
      citations: quoted_content ? [{ quoted_type, quoted_content }] : [],
    });

    // Step 3：呼叫 AI（把引用內容傳進去）
    const evidence = await retrieverAgent(query);
    const { knowledgeAnswer, companionResponse, citations } =
      await answererAgent(query, quoted_content, quoted_type);

    // Step 4：存 AI 回答（含 citations 在 metadata）
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

// GET /api/chat/history（取得對話列表）
router.get("/history", verifyToken, attachUserId, async (req, res) => {
  const userId = req.userId;
  try {
    const conversations = await pool.query(
      `SELECT conversation_id, title, created_at, updated_at, status
       FROM conversations
       WHERE user_id = $1 AND deleted_at IS NULL
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

// POST /api/chat/conversations（建立新對話，4.3.2）
router.post("/conversations", verifyToken, attachUserId, async (req, res) => {
  const userId = req.userId;
  try {
    const result = await pool.query(
      `INSERT INTO conversations (user_id, status, created_at, updated_at)
       VALUES ($1, 'active', NOW(), NOW())
       RETURNING conversation_id, title, created_at`,
      [userId]
    );
    return res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("[POST /conversations] failed:", err.message);
    return res.status(500).json({ ok: false, error: "建立對話失敗" });
  }
});

// POST /api/chat/stream（SSE 串流版發送，4.1.3 逐句顯示）
router.post("/stream", verifyToken, attachUserId, async (req, res) => {
  const { message, conversationId, quoted_content, quoted_type } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ ok: false, error: "message 欄位不得為空" });
  }

  // 設定 SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const query = message.trim();
  const userId = req.userId;

  try {
    // Step 1：建立或取得對話
    const convId = await getOrCreateConversation(userId, conversationId);
    send({ type: "start", conversationId: convId });

    // Step 2：存使用者訊息
    await saveMessage({
      conversationId: convId,
      role: "user",
      content: query,
      companionResponse: null,
      citations: quoted_content ? [{ quoted_type, quoted_content }] : [],
    });

    // Step 3：Retriever（search 供 Magisterium 參考）+ Magisterium chat
    await retrieverAgent(query);
    const chatResult = await mcp.chat(query);
    const rawAnswer = chatResult?.answer || "";
    const magisteriumCitations = chatResult?.citations || [];

    const quoteLabel = quoted_type === "knowledge" ? "知識回答" : "陪伴回應";
    const quoteContext = quoted_content
      ? `\n\n[使用者引用的${quoteLabel}]：\n${quoted_content}\n\n請特別針對使用者引用的這段內容來回答。`
      : "";

    const knowledgeSystemPrompt = `你是「有答大師」，一個天主教信仰助理。
你的任務是將 Magisterium AI 提供的英文神學回答，整理成清晰、易懂的繁體中文。

規則：
1. 只能根據提供的資料回答，不可自行添加未經引用的內容
2. 保留所有引用來源，格式為【文件名稱】
3. 使用條列式或分段方式讓回答更易讀
4. 語氣要溫和、尊重，適合信仰探討
5. 如果資料不足以回答問題，誠實說明`;

    const knowledgeUserMessage = `使用者的問題：${query}${quoteContext}

Magisterium AI 的回答（請整理成繁體中文）：
${rawAnswer}`;

    // Step 4：串流輸出知識回答
    let knowledgeAnswer = "";
    const streamRes = await callGroqStreamResponse(knowledgeSystemPrompt, knowledgeUserMessage, { temperature: 0.3, max_tokens: 800 });

    if (streamRes) {
      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // 保留未完成的行

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
      // Fallback：Ollama 不支援串流，一次送出
      knowledgeAnswer = await callOllama(knowledgeSystemPrompt, knowledgeUserMessage, { temperature: 0.3, max_tokens: 800 });
      send({ type: "knowledge_chunk", text: knowledgeAnswer });
    }

    // Step 5：陪伴回應（非串流，送出後一次推播）
    const companionSystemPrompt = `你是「有答大師」的陪伴模式，一個溫暖的天主教信仰陪伴者。
你的任務是針對使用者的問題，提供一段簡短、溫暖、具同理心的回應。

規則：
1. 不可冒充神父或提供靈修指導
2. 不可給出神學判斷或道德裁決
3. 只能提供情感支持和引導式提問
4. 語氣要像一個關心的朋友
5. 結尾可以提供一個引導式問題，邀請使用者繼續探索`;

    const companionUserMessage = `使用者的問題：${query}${quoteContext}

請給出一段溫暖的情感陪伴回應（2-3句話即可，不要重複知識回答的內容）：`;

    let companionResponse = null;
    try {
      companionResponse = await callLLM(companionSystemPrompt, companionUserMessage, { temperature: 0.8, max_tokens: 300 });
    } catch (err) {
      console.warn("[Stream] companion failed:", err.message);
    }

    const citations = magisteriumCitations.map((c) => ({
      tier: SOURCE_TIER.MAGISTERIUM,
      title: c.document_title || "",
      author: c.document_author || "",
      year: c.document_year || "",
      reference: c.document_reference || "",
      cited_text: c.cited_text || "",
      url: c.source_url || "",
    }));

    // Step 6：存 AI 回答
    await saveMessage({
      conversationId: convId,
      role: "assistant",
      content: knowledgeAnswer,
      companionResponse,
      citations,
    });

    // Step 7：推播剩餘資料後結束
    send({ type: "companion", text: companionResponse });
    send({ type: "citations", data: citations });
    send({ type: "done", conversationId: convId });
    res.end();
  } catch (err) {
    console.error("[POST /api/chat/stream] failed:", err.message);
    send({ type: "error", message: "有答大師暫時無法回應，請稍後再試" });
    res.end();
  }
});

// GET /api/chat/:conversationId/messages（取得特定對話的訊息）
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
    const formattedMessages = messages.rows.map(msg => ({
      message_id: msg.message_id,
      role: msg.ms_role,
      content: msg.ms_content,
      companion_response: msg.metadata?.companion_response || null,
      citations: msg.metadata?.citations || [],
      created_at: msg.created_at,
    }));
    return res.json({ ok: true, data: formattedMessages });
  } catch (err) {
    console.error("[GET messages] failed:", err.message);
    return res.status(500).json({ ok: false, error: "取得訊息失敗" });
  }
});

// PATCH /api/chat/:conversationId/title（修改對話標題，4.4.2）
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

// DELETE /api/chat/:conversationId（軟刪除對話，4.4.3）
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

// POST /api/chat/test-send（開發測試用，上線前刪掉）
router.post("/test-send", async (req, res) => {
  const { message, quoted_content, quoted_type } = req.body;
  if (!message) return res.status(400).json({ ok: false, error: "message 必填" });
  try {
    const evidence = await retrieverAgent(message);
    const { knowledgeAnswer, companionResponse, citations } =
      await answererAgent(message, quoted_content, quoted_type);
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