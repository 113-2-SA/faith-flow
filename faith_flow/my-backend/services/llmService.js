// services/llmService.js
// LLM 呼叫層：Groq（優先）、Ollama（fallback）；Mistral 專用情緒分析

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

// 回傳 fetch Response 供 SSE 串流使用
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

// 優先 Groq，fallback Ollama
async function callLLM(systemPrompt, userMessage, options = {}) {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey) return await callGroq(groqApiKey, systemPrompt, userMessage, options);
  return await callOllama(systemPrompt, userMessage, options);
}

async function callMistral(systemPrompt, userMessage, options = {}) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY not set");
  const model = process.env.MISTRAL_EMOTION_MODEL || "mistral-small-latest";
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
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
      temperature: options.temperature ?? 0.1,
      max_tokens: options.max_tokens ?? 10,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Mistral API failed ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

module.exports = { callLLM, callGroq, callGroqStreamResponse, callOllama, callMistral };
