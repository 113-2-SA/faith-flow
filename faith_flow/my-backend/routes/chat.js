// my-backend/routes/chat.js
// POST /api/chat/send  <- 有答大師主入口
// 架構：Two-Agent Pipeline + DB儲存 + 引用回覆功能

const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const attachUserId = require("../middleware/attachuserId");
const mcp = require("../services/magisteriumMcp");
const pool = require("../config/database");
const { findRelevantDiaries } = require("../services/embeddingService");

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
      temperature: options.temperature ?? 0.82,
      max_tokens: options.max_tokens ?? 4096,
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
      temperature: options.temperature ?? 0.82,
      max_tokens: options.max_tokens ?? 4096,
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
        temperature: options.temperature ?? 0.82,
        max_tokens: options.max_tokens ?? 4096,
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
    `INSERT INTO conversations (user_id, title, status, created_at, updated_at)
     VALUES ($1, '新對話', 'active', NOW(), NOW())
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
async function answererAgent(query, quotedContent, quotedType, options = {}) {
  const { knowledgeMaxTokens = 800, companionMaxTokens = 250, companionTone = 'BALANCED' } = options;
  const chatResult = await mcp.chat(query);
  const rawAnswer = chatResult?.answer || "";
  const magisteriumCitations = chatResult?.citations || [];

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
5. 結尾可以提供一個引導式問題，邀請使用者繼續探索
6. 【重要】請只使用繁體中文，絕對不得使用簡體字`;

  const companionUserMessage = `使用者的問題：${query}${quoteContext}

請給出一段溫暖的情感陪伴回應（2-3句話即可，不要重複知識回答的內容）：`;

  const knowledgeAnswer = await callLLM(
    knowledgeSystemPrompt, knowledgeUserMessage, { temperature: 0.3, max_tokens: knowledgeMaxTokens }
  );

  let companionResponse = null;
  try {
    companionResponse = await callLLM(
      companionSystemPrompt, companionUserMessage, { temperature: 0.8, max_tokens: companionMaxTokens }
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

// ⭐ 情緒分析函式（獨立出來，方便在串流前呼叫）
async function analyzeEmotion(query) {
  try {
    const emotionSystemPrompt = `你是一個情緒分析助理。
請分析使用者的問題，判斷這個問題偏向「感性（情感需求）」還是「理性（知識探索）」。

請只回傳一個 0 到 100 的整數，不要有任何其他文字：
- 0 = 完全感性（例如：我很難過、我需要幫助、我感到迷茫）
- 50 = 中性（例如：請解釋聖經某段經文）
- 100 = 完全理性（例如：天主教的神學定義是什麼）

只回傳數字，不要解釋。`;

    const emotionResult = await callLLM(
      emotionSystemPrompt,
      `使用者的問題：${query}`,
      { temperature: 0.1, max_tokens: 10 }
    );

    const parsed = parseInt(emotionResult.trim(), 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      return parsed;
    }
    return 50; // 解析失敗用預設值
  } catch (err) {
    console.warn("[analyzeEmotion] failed:", err.message);
    return 50;
  }
}

// ⭐ 根據情緒分數決定回覆比重
function getTokenConfig(emotionScore) {
  if (emotionScore <= 30) {
    return { companionMaxTokens: 400, knowledgeMaxTokens: 1200, companionTone: 'HIGH_EMOTION' };
  } else if (emotionScore <= 60) {
    return { companionMaxTokens: 250, knowledgeMaxTokens: 2000, companionTone: 'BALANCED' };
  } else {
    return { companionMaxTokens: 120, knowledgeMaxTokens: 3000, companionTone: 'LOW_EMOTION' };
  }
}

// POST /api/chat/send（需要 Firebase token + userId）
router.post("/send", verifyToken, attachUserId, async (req, res) => {
  const { message, conversationId, quoted_content, quoted_type, emotion_score } = req.body;

  // 前端傳來的累積分數（用於計算加權平均，不直接決定比重）
  const currentEmotionScore = typeof emotion_score === 'number' ? emotion_score : 50;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ ok: false, error: "message 欄位不得為空" });
  }

  const query = message.trim();
  const userId = req.userId;

  try {
    // Step 1：建立或取得對話
    const convId = await getOrCreateConversation(userId, conversationId);

    // Step 2：存使用者訊息
    await saveMessage({
      conversationId: convId,
      role: "user",
      content: query,
      companionResponse: null,
      citations: quoted_content ? [{ quoted_type, quoted_content }] : [],
    });

    // ⭐ Step 2.5：先做情緒分析，決定這次回覆的比重
    const newEmotionScore = await analyzeEmotion(query);
    const { companionMaxTokens, knowledgeMaxTokens, companionTone } = getTokenConfig(newEmotionScore);
    console.log(`[Send] 情緒分析完成: ${newEmotionScore}，tone: ${companionTone}`);

    // Step 3：呼叫 AI
    const evidence = await retrieverAgent(query);
    const { knowledgeAnswer, companionResponse, citations } =
      await answererAgent(query, quoted_content, quoted_type, { knowledgeMaxTokens, companionMaxTokens, companionTone });

    // Step 4：存 AI 回答
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
        emotion_score: newEmotionScore, // 回傳新的情緒分數
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

// POST /api/chat/conversations（建立新對話）
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
  const { message, conversationId, quoted_content, quoted_type, emotion_score } = req.body;

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

    // ⭐ Step 2.5：情緒分析 + 標題生成 + 日記RAG 並行執行（節省時間）
    const [newEmotionScore, , diaryContextResult] = await Promise.allSettled([
      // 任務1：情緒分析（本次問題）
      analyzeEmotion(query),

      // 任務2：自動生成標題（第一則訊息才做）
      (async () => {
        try {
          const msgCount = await pool.query(
            `SELECT COUNT(*) FROM messages WHERE conversation_id = $1`,
            [convId]
          );
          const count = parseInt(msgCount.rows[0].count, 10);
          if (count <= 1) {
            const titleResult = await callLLM(
              `你是一個標題生成助理。請根據使用者的問題，生成一個簡短、精準的對話標題。
規則：
1. 標題長度：10個字以內
2. 直接輸出標題文字，不要加引號或標點
3. 使用繁體中文
4. 捕捉問題的核心主題`,
              `使用者的問題：${query}\n\n請生成標題：`,
              { temperature: 0.3, max_tokens: 30 }
            );
            const autoTitle = titleResult.trim().slice(0, 20);
            if (autoTitle) {
              await pool.query(
                `UPDATE conversations SET title = $1, updated_at = NOW() WHERE conversation_id = $2`,
                [autoTitle, convId]
              );
              send({ type: "title", title: autoTitle });
            }
          }
        } catch (err) {
          console.warn("[Stream] auto title failed:", err.message);
        }
      })(),

      // 任務3：日記 RAG
      (async () => {
        try {
          const relevantDiaries = await findRelevantDiaries(userId, query, pool, 3);
          if (relevantDiaries.length > 0) {
            console.log("[Stream] 找到 " + relevantDiaries.length + " 篇相關日記");
            const diarySnippets = relevantDiaries.map((d, i) =>
              "[日記 " + (i + 1) + "] " + d.diary_date + " - " + d.diary_title + "：" + d.diary_content.slice(0, 300)
            ).join("\n\n");
            return "\n\n[使用者的相關日記紀錄（請參考這些內容來個人化回答）]：\n" + diarySnippets + "\n\n請根據以上日記，結合教會教義，給予更貼近使用者個人處境的回答。";
          }
          return "";
        } catch (err) {
          console.warn("[Stream] diary RAG failed:", err.message);
          return "";
        }
      })(),
    ]);

    // ⭐ 取得情緒分析結果，決定這次回覆的 token 比重
    const thisEmotionScore = newEmotionScore.status === 'fulfilled' ? newEmotionScore.value : 50;
    const { companionMaxTokens, knowledgeMaxTokens, companionTone } = getTokenConfig(thisEmotionScore);
    const diaryContext = diaryContextResult.status === 'fulfilled' ? diaryContextResult.value : "";

    console.log(`[Stream] 情緒分析: ${thisEmotionScore}，tone: ${companionTone}，knowledge: ${knowledgeMaxTokens}, companion: ${companionMaxTokens}`);

    // Step 3：Magisterium 搜尋
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
5. 如果資料不足以回答問題，誠實說明
6. 【重要】請只使用繁體中文，絕對不得使用簡體字`;

    const knowledgeUserMessage = `使用者的問題：${query}${quoteContext}${diaryContext}

Magisterium AI 的回答（請整理成繁體中文）：
${rawAnswer}`;

    // Step 4：串流輸出知識回答
    let knowledgeAnswer = "";
    const streamRes = await callGroqStreamResponse(knowledgeSystemPrompt, knowledgeUserMessage, { temperature: 0.3, max_tokens: knowledgeMaxTokens });

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
      knowledgeAnswer = await callOllama(knowledgeSystemPrompt, knowledgeUserMessage, { temperature: 0.3, max_tokens: knowledgeMaxTokens });
      send({ type: "knowledge_chunk", text: knowledgeAnswer });
    }

    // Step 5：陪伴回應（根據情緒分數調整語氣）
    const toneInstruction = companionTone === 'HIGH_EMOTION'
      ? '使用者情緒低落，需要大量情感支持，請給予4-5句溫暖安慰的話。'
      : companionTone === 'BALANCED'
      ? '使用者情緒平穩，請給予2-3句適度的情感支持。'
      : '使用者主要想探索知識，陪伴回應請簡短，1-2句話即可。';

    const companionSystemPrompt = `你是「有答大師」的陪伴模式，一個溫暖的天主教信仰陪伴者。
你的任務是針對使用者的問題，提供溫暖、具同理心的回應。

規則：
1. 不可冒充神父或提供靈修指導
2. 不可給出神學判斷或道德裁決
3. 只能提供情感支持和引導式提問
4. 語氣要像一個關心的朋友
5. 結尾可以提供一個引導式問題，邀請使用者繼續探索
6. 【重要】請只使用繁體中文，絕對不得使用簡體字
7. ${toneInstruction}`;

    const companionUserMessage = `使用者的問題：${query}${quoteContext}

請給出溫暖的情感陪伴回應（不要重複知識回答的內容）：`;

    let companionResponse = null;
    try {
      companionResponse = await callLLM(companionSystemPrompt, companionUserMessage, { temperature: 0.8, max_tokens: companionMaxTokens });
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
    send({ type: "emotion", score: thisEmotionScore }); // ⭐ 回傳本次分析的情緒分數
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

// PATCH /api/chat/:conversationId/title（修改對話標題）
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

// DELETE /api/chat/:conversationId（軟刪除對話）
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