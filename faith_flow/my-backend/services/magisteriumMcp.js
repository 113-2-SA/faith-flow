// my-backend/services/magisteriumMcp.js
// 改用 API Key 版本（告別 MCP OAuth 每小時過期的痛苦）
// API 文件：https://www.magisterium.com/developers/docs

const CHAT_URL = "https://www.magisterium.com/api/v1/chat/completions";
const SEARCH_URL = "https://www.magisterium.com/api/v1/search";

function getApiKey() {
  const key = process.env.MAGISTERIUM_API_KEY;
  if (!key) {
    throw new Error(
      "❌ 缺少 MAGISTERIUM_API_KEY 環境變數\n" +
      "   請在 .env 加上：MAGISTERIUM_API_KEY=你的key"
    );
  }
  return key;
}

// ─── chat：問答 + 自動帶 citations ───────────────────────────────────────
// 回傳：{ answer: string, citations: Citation[] }
async function chat(prompt, options = {}) {
  const apiKey = getApiKey();

  const body = {
    model: options.model || "magisterium-1",
    messages: [{ role: "user", content: prompt }],
    stream: false,
  };

  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Magisterium chat failed ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();

  return {
    answer: data.choices?.[0]?.message?.content || "",
    // citations 每項含：cited_text / document_title / document_author / source_url 等
    citations: data.citations || [],
    _raw: data,
  };
}

// ─── search：向量搜尋，回傳相關文件列表 ──────────────────────────────────
// 回傳：{ results: SearchResult[] }
async function search(query) {
  const apiKey = getApiKey();

  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Magisterium search failed ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  return {
    results: data.results || [],
    _raw: data,
  };
}

// ─── callTool：保留舊介面相容性，routes/chat.js 不需要改 ─────────────────
async function callTool(name, args) {
  if (name === "chat") {
    const result = await chat(args.prompt || args.query || "");
    return {
      content: [{ type: "text", text: result.answer }],
      citations: result.citations,
    };
  }

  if (name === "search") {
    const result = await search(args.query || "");
    return {
      content: [{ type: "text", text: JSON.stringify({ results: result.results }) }],
    };
  }

  if (name === "fetch") {
    // REST API 目前沒有 fetch by id，先用空值替代
    console.warn(`[magisteriumMcp] fetch by id (${args.id}) 尚未支援`);
    return { content: [{ type: "text", text: "" }] };
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ─── listTools：靜態回傳，不需要網路 ─────────────────────────────────────
function listTools() {
  return {
    tools: [
      { name: "chat",   description: "Chat with Magisterium AI. Returns answer with citations." },
      { name: "search", description: "Search Catholic sources by natural language query." },
    ],
  };
}

async function fetchById(id) {
  return await callTool("fetch", { id });
}

module.exports = { chat, search, callTool, listTools, fetchById };