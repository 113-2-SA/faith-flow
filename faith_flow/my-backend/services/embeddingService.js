// my-backend/services/embeddingService.js
// 使用 Jina AI 將文字轉成向量，用於日記語意搜尋

const JINA_API_KEY = process.env.JINA_API_KEY;
const JINA_MODEL = 'jina-embeddings-v3';

// 把文字轉成向量（1024 維）
async function getEmbedding(text) {
  if (!JINA_API_KEY) throw new Error('缺少 JINA_API_KEY 環境變數');

  const res = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JINA_API_KEY}`,
    },
    body: JSON.stringify({
      model: JINA_MODEL,
      task: 'retrieval.passage',  // 存日記時用這個
      input: [text.slice(0, 2000)], // 最多2000字，避免超過限制
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Jina API failed: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.data[0].embedding; // 回傳數字陣列
}

// 把問題轉成向量（query 用不同 task）
async function getQueryEmbedding(text) {
  if (!JINA_API_KEY) throw new Error('缺少 JINA_API_KEY 環境變數');

  const res = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JINA_API_KEY}`,
    },
    body: JSON.stringify({
      model: JINA_MODEL,
      task: 'retrieval.query',  // 搜尋時用這個
      input: [text.slice(0, 500)],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Jina API failed: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

// 計算兩個向量的餘弦相似度（0~1，越高越相似）
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 從使用者日記中找最相關的幾篇
// userId: 使用者ID, queryText: 使用者的問題, pool: DB連線, topK: 取幾篇
async function findRelevantDiaries(userId, queryText, pool, topK = 3) {
  try {
    // 1. 把問題轉成向量
    const queryVec = await getQueryEmbedding(queryText);

    // 2. 從 DB 取出該使用者所有有 embedding 的日記
    const result = await pool.query(
      `SELECT diary_id, diary_title, diary_content, diary_date, embedding
       FROM diary
        WHERE user_id = $1
         AND embedding IS NOT NULL
       ORDER BY diary_date DESC
       LIMIT 50`, // 最多取50篇來比較
      [userId]
    );

    if (result.rows.length === 0) return [];

    // 3. 計算每篇日記跟問題的相似度
    const scored = result.rows
      .map(row => ({
        ...row,
        score: cosineSimilarity(queryVec, row.embedding),
      }))
      .filter(row => row.score > 0.3) // 只取相似度 > 0.3 的
      .sort((a, b) => b.score - a.score) // 由高到低排序
      .slice(0, topK); // 取前 topK 篇

    return scored;
  } catch (err) {
    console.warn('[EmbeddingService] findRelevantDiaries failed:', err.message);
    return []; // 失敗就回傳空陣列，不影響主流程
  }
}

module.exports = { getEmbedding, getQueryEmbedding, cosineSimilarity, findRelevantDiaries };