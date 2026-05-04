// services/catholicKnowledgeService.js
// 從本地天主教知識庫（聖經金句、通諭段落）找出與問題最相關的內容

const { getQueryEmbedding, cosineSimilarity } = require('./embeddingService');

// topK: 最多回傳幾筆，threshold: 相似度門檻
async function findRelevantKnowledge(queryText, pool, topK = 3, threshold = 0.35) {
  try {
    const queryVec = await getQueryEmbedding(queryText);

    const result = await pool.query(
      `SELECT id, category, title, reference, content, author, year, embedding
       FROM catholic_knowledge
       WHERE embedding IS NOT NULL`
    );

    if (result.rows.length === 0) return [];

    const scored = result.rows
      .map(row => {
        const vec = typeof row.embedding === 'string'
          ? JSON.parse(row.embedding)
          : row.embedding;
        return { ...row, score: cosineSimilarity(queryVec, vec) };
      })
      .filter(r => r.score > threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored;
  } catch (err) {
    console.warn('[CatholicKnowledge] findRelevantKnowledge failed:', err.message);
    return [];
  }
}

module.exports = { findRelevantKnowledge };
