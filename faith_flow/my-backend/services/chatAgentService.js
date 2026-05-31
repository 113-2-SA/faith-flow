// services/chatAgentService.js
// 有答大師 AI pipeline：Two-Agent + DB 操作 + 情緒分析

const pool = require("../config/database");
const mcp = require("./magisteriumMcp");
const { findRelevantDiaries } = require("./embeddingService");
const { callLLM, callMistral } = require("./llmService");

const SOURCE_TIER = {
  MAGISTERIUM: "A",
  DB_TEXT: "B",
  DIARY: "C",
  MODEL: "D",
};

// ── DB 操作 ────────────────────────────────────────────────

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

async function getUserProfile(userId) {
  try {
    const result = await pool.query(
      `SELECT user_profile FROM "user" WHERE "userID" = $1`,
      [userId]
    );
    return result.rows[0]?.user_profile || "";
  } catch (err) {
    console.warn("[chatAgentService] getUserProfile 失敗:", err.message);
    return "";
  }
}

// 第一則訊息才生成，回傳自動標題（或 null）
async function generateAutoTitle(convId, query) {
  const msgCount = await pool.query(
    `SELECT COUNT(*) FROM messages WHERE conversation_id = $1`,
    [convId]
  );
  const count = parseInt(msgCount.rows[0].count, 10);
  if (count > 1) return null;

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
  if (!autoTitle) return null;

  await pool.query(
    `UPDATE conversations SET title = $1, updated_at = NOW() WHERE conversation_id = $2`,
    [autoTitle, convId]
  );
  return autoTitle;
}

// ── AI Agents ──────────────────────────────────────────────

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

// Agent 2：Answerer（給 /send 非串流使用）
async function answererAgent(query, quotedContent, quotedType, options = {}) {
  const {
    knowledgeMaxTokens = 800,
    companionMaxTokens = 250,
    companionTone = "BALANCED",
    userProfile = "",
  } = options;

  const chatResult = await mcp.chat(query);
  const rawAnswer = chatResult?.answer || "";
  const magisteriumCitations = chatResult?.citations || [];

  const quoteLabel = quotedType === "knowledge" ? "知識回答" : "陪伴回應";
  const quoteContext = quotedContent
    ? `\n\n[使用者引用的${quoteLabel}]：\n${quotedContent}\n\n請特別針對使用者引用的這段內容來回答。`
    : "";

  const profileContext = userProfile
    ? `【使用者自我介紹】${userProfile}\n若使用者自述年資則以其說法為準；否則依敘述推估：5年以下為資淺、6~10年為較資深、10年以上為資深。\n`
    : "";

  const knowledgeSystemPrompt = `你是「有答大師」，一個天主教信仰助理。
你的任務是將 Magisterium AI 提供的英文神學回答，整理成清晰、易懂的繁體中文。

${profileContext}規則：
1. 只能根據提供的資料回答，不可自行添加未經引用的內容
2. 不需要在回覆中標註引用來源，來源已另外顯示
3. 【重要】回覆總字數限制在100字以內，簡潔扼要
4. 語氣要溫和、尊重，適合信仰探討；資淺者多用生活化比喻，較資深／資深者可適度使用神學術語
5. 如果資料不足以回答問題，誠實用一句話說明`;

  const knowledgeUserMessage = `使用者的問題：${query}${quoteContext}

Magisterium AI 的回答（請整理成繁體中文）：
${rawAnswer}`;

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
${profileContext ? `8. ${profileContext}依信仰資歷調整語氣：資淺者多鼓勵引導、較資深者平等分享、資深者可共同深思。` : ""}`;

  const companionUserMessage = `使用者的問題：${query}${quoteContext}

請給出一段溫暖的情感陪伴回應（2-3句話即可，不要重複知識回答的內容）：`;

  const knowledgeAnswer = await callLLM(
    knowledgeSystemPrompt,
    knowledgeUserMessage,
    { temperature: 0.3, max_tokens: knowledgeMaxTokens }
  );

  let companionResponse = null;
  try {
    companionResponse = await callLLM(
      companionSystemPrompt,
      companionUserMessage,
      { temperature: 0.8, max_tokens: companionMaxTokens }
    );
  } catch (err) {
    console.warn("[Answerer] companion failed, skipping:", err.message);
  }

  const citations = deduplicateCitations(magisteriumCitations);
  return { knowledgeAnswer, companionResponse, citations };
}

// ── 情緒分析 ───────────────────────────────────────────────

async function analyzeEmotion(query) {
  try {
    const emotionSystemPrompt = `你是一個情緒分析助理。
請分析以下問題的情緒程度，回傳一個 0 到 100 的數字：
- 0 = 純感性（充滿情緒、個人感受、心理困擾）
- 50 = 中等（情緒與理性並重）
- 100 = 純理性（純粹知識性、神學教義問題）
只回傳數字，不要其他文字。`;

    const result = await callMistral(
      emotionSystemPrompt,
      `請分析這個問題的情緒程度：${query}`,
      { temperature: 0.1, max_tokens: 10 }
    );
    const parsed = parseInt(result.trim(), 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) return parsed;
    return 50;
  } catch (err) {
    console.warn("[analyzeEmotion] failed:", err.message);
    return 50;
  }
}

// 情緒分數 0=純感性、100=純理性
function getTokenConfig(emotionScore) {
  if (emotionScore <= 30) {
    return { companionMaxTokens: 150, knowledgeMaxTokens: 200, companionTone: "HIGH_EMOTION" };
  } else if (emotionScore <= 60) {
    return { companionMaxTokens: 150, knowledgeMaxTokens: 200, companionTone: "BALANCED" };
  } else {
    return { companionMaxTokens: 100, knowledgeMaxTokens: 200, companionTone: "LOW_EMOTION" };
  }
}

// ── 工具函式 ───────────────────────────────────────────────

// 去除重複標題後取前 5 筆並格式化
function deduplicateCitations(magisteriumCitations) {
  const seenTitles = new Set();
  return magisteriumCitations
    .filter((c) => {
      const title = c.document_title || "";
      if (seenTitles.has(title)) return false;
      seenTitles.add(title);
      return true;
    })
    .slice(0, 5)
    .map((c) => ({
      tier: SOURCE_TIER.MAGISTERIUM,
      title: c.document_title || "",
      author: c.document_author || "",
      year: c.document_year || "",
      reference: c.document_reference || "",
      cited_text: c.cited_text || "",
      url: c.source_url || "",
    }));
}

// 取得使用者相關日記（用於 RAG 個人化）
async function getDiaryContext(userId, query) {
  try {
    const relevantDiaries = await findRelevantDiaries(userId, query, pool, 3);
    if (relevantDiaries.length === 0) return "";
    console.log("[chatAgentService] 找到 " + relevantDiaries.length + " 篇相關日記");
    const snippets = relevantDiaries
      .map((d, i) =>
        `[日記 ${i + 1}] ${d.diary_date} - ${d.diary_title}：${d.diary_content.slice(0, 300)}`
      )
      .join("\n\n");
    return `\n\n[使用者的相關日記紀錄（請參考這些內容來個人化回答）]：\n${snippets}\n\n請根據以上日記，結合教會教義，給予更貼近使用者個人處境的回答。`;
  } catch (err) {
    console.warn("[chatAgentService] getDiaryContext 失敗:", err.message);
    return "";
  }
}

module.exports = {
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
};
