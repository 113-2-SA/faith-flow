// my-backend/scripts/generateEmbedding.js
// 手動為指定日記產生 embedding（測試用）

require('dotenv').config();
const pool = require('../config/database');
const { getEmbedding } = require('../services/embeddingService');

async function main() {
  const diaryId = 1; // 你的 diary_id

  try {
    // 取得日記內容
    const result = await pool.query(
      'SELECT diary_id, diary_title, diary_content FROM diary WHERE diary_id = $1',
      [diaryId]
    );

    if (result.rows.length === 0) {
      console.log('找不到日記');
      process.exit(1);
    }

    const diary = result.rows[0];
    const text = [diary.diary_title, diary.diary_content].join(' ');
    console.log('📝 日記內容:', text.slice(0, 50) + '...');

    // 產生 embedding
    console.log('⏳ 呼叫 Jina AI 產生 embedding...');
    const embedding = await getEmbedding(text);
    console.log('✅ embedding 維度:', embedding.length);

    // 存回 DB
    await pool.query(
      'UPDATE diary SET embedding = $1 WHERE diary_id = $2',
      [JSON.stringify(embedding), diaryId]
    );
    console.log('✅ embedding 已存入 DB！');

  } catch (err) {
    console.error('❌ 失敗:', err.message);
  } finally {
    await pool.end();
  }
}

main();