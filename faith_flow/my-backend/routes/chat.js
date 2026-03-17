// my-backend/routes/chat.js
// POST /api/chat/send  ← 有答大師主入口
// 架構：Two-Agent Pipeline
//   Agent 1 (Retriever)：Magisterium search 找證據
//   Agent 2 (Answerer)：Magisterium chat 取得知識回答，Qwen 整理輸出＋情感陪伴

const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const attachUserId = require("../middleware/attachuserId");
const mcp = require("../services/magisteriumMcp");

// ─── Tier 定義 ────────────────────────────────────────────────────────────
const SOURCE_TIER = {
  MAGISTERIUM: "A", // 最高權威：Magisterium
  DB_TEXT: "B",     // 原典 / 通諭（尚未接）
  DIARY: "C",       // 日記摘要（尚未接）
  MODEL: "D",       // 模型一般推論（不可冒充權威）
};

// ─── Qwen 呼叫（OpenAI-compatible API）───────────────────────────────────
async function callQwen(systemPrompt, userMessage, options = {}) {
  const baseUrl = process.env.QWEN_BASE_URL || "http://localhost:11434";
  const model = process.env.QWEN_MODEL || "qwen2.5:14b";

  // 加這個：120秒 timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "faith-flow-backend/1.0",
      },
      signal: controller.signal,  // 加這行
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userMessage },
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens:  options.max_tokens  ?? 1024,
        stream: false,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Qwen API failed ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(timeout);  // 加這行
  }
}

// ─── Agent 1：Retriever ───────────────────────────────────────────────────
async function retrieverAgent(query) {
  try {
    const searchResult = await mcp.search(query);
    return {
      tier: SOURCE_TIER.MAGISTERIUM,
      results: searchResult.results || [],
    };
  } catch (err) {
    console.error("[Retriever] search failed:", err.message);
    return { tier: SOURCE_TIER.MAGISTERIUM, results: [] };
  }
}

// ─── Agent 2：Answerer ────────────────────────────────────────────────────
// Step 1：用 Magisterium chat 取得有引用的知識回答
// Step 2：用 Qwen 把回答整理成繁體中文，並產生情感陪伴
async function answererAgent(query, evidence) {
  // Step 1：Magisterium 取得知識回答（英文，含 citation）
  const chatResult = await mcp.chat(query);
  const rawAnswer = chatResult?.answer || "";
  const magisteriumCitations = chatResult?.citations || [];

  // Step 2a：Qwen 整理知識回答（翻譯 + 格式化 + 加引用標記）
  const knowledgeSystemPrompt = `你是「有答大師」，一個天主教信仰助理。
你的任務是將 Magisterium AI 提供的英文神學回答，整理成清晰、易懂的繁體中文。

規則：
1. 只能根據提供的資料回答，不可自行添加未經引用的內容
2. 保留所有引用來源，格式為【文件名稱】
3. 使用條列式或分段方式讓回答更易讀
4. 語氣要溫和、尊重，適合信仰探討
5. 如果資料不足以回答問題，誠實說明`;

  const knowledgeUserMessage = `使用者的問題：${query}

Magisterium AI 的回答（請整理成繁體中文）：
${rawAnswer}`;

  // Step 2b：Qwen 產生情感陪伴回應
  const companionSystemPrompt = `你是「有答大師」的陪伴模式，一個溫暖的天主教信仰陪伴者。
你的任務是針對使用者的問題，提供一段簡短、溫暖、具同理心的回應。

規則：
1. 不可冒充神父或提供靈修指導
2. 不可給出神學判斷或道德裁決
3. 只能提供情感支持和引導式提問
4. 語氣要像一個關心的朋友
5. 結尾可以提供一個引導式問題，邀請使用者繼續探索`;

  const companionUserMessage = `使用者的問題：${query}

請給出一段溫暖的情感陪伴回應（2-3句話即可，不要重複知識回答的內容）：`;

  // 並行呼叫 Qwen（節省時間）
  const knowledgeAnswer = await callQwen(
  knowledgeSystemPrompt, knowledgeUserMessage, { temperature: 0.3 }
);

let companionResponse = null;
try {
  companionResponse = await callQwen(
    companionSystemPrompt, companionUserMessage, { temperature: 0.8, max_tokens: 300 }
  );
} catch (err) {
  console.warn("[Answerer] companion failed, skipping:", err.message);
}

  // 整合 citations
  const citations = [
    // Magisterium chat 回傳的 citations（含 cited_text、source_url 等）
    ...magisteriumCitations.map((c) => ({
      tier: SOURCE_TIER.MAGISTERIUM,
      title: c.document_title || "",
      author: c.document_author || "",
      year: c.document_year || "",
      reference: c.document_reference || "",
      cited_text: c.cited_text || "",
      url: c.source_url || "",
    })),
  ];

  return { knowledgeAnswer, companionResponse, citations };
}

// ─── POST /api/chat/send（需要 Firebase token）────────────────────────────
router.post("/send", verifyToken, attachUserId, async (req, res) => {
  const { message, conversationId } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ ok: false, error: "message 欄位不得為空" });
  }

  const query = message.trim();

  try {
    const evidence = await retrieverAgent(query);
    const { knowledgeAnswer, companionResponse, citations } =
      await answererAgent(query, evidence);

    return res.json({
      ok: true,
      data: {
        conversationId: conversationId || null,
        query,
        knowledge_answer: knowledgeAnswer,
        companion_response: companionResponse,
        citations,
        meta: {
          retriever_count: evidence.results.length,
          citations_count: citations.length,
          answer_tier: SOURCE_TIER.MAGISTERIUM,
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

// ─── GET /api/chat/history（Placeholder）─────────────────────────────────
router.get("/history", verifyToken, attachUserId, (req, res) => {
  return res.json({
    ok: true,
    data: [],
    message: "對話歷史功能即將推出（等待 DB schema）",
  });
});

// ─── POST /api/chat/test-send（開發測試用，上線前刪掉）───────────────────
router.post("/test-send", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ ok: false, error: "message 必填" });

  try {
    const evidence = await retrieverAgent(message);
    const { knowledgeAnswer, companionResponse, citations } =
      await answererAgent(message, evidence);

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
        },
      },
    });
  } catch (err) {
    console.error("[test-send] failed:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;