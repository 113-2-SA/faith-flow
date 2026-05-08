require('dotenv').config();
const pool = require('./config/database');
const questions = require('./scripts/faithflow_questions_with_assets.json');

async function main() {
  console.log('開始匯入', questions.length, '題...');
  let success = 0;
  let failed = 0;

  for (const q of questions) {
    try {
      await pool.query(
        'INSERT INTO ai_questions (question_text, is_active, theme, source_hint, quote, quote_source, image_prompt, is_ready) VALUES ($1, true, $2, $3, $4, $5, $6, true) ON CONFLICT DO NOTHING',
        [q.question, q.theme || '', q.source_hint || '', q.quote || '', q.quote_source || '', q.image_prompt || '']
      );
      success++;
    } catch(e) {
      console.error('失敗:', q.question?.slice(0, 20), e.message);
      failed++;
    }
  }

  const count = await pool.query('SELECT COUNT(*) FROM ai_questions');
  console.log('匯入完成！成功:', success, '/ 失敗:', failed, '/ DB 總筆數:', count.rows[0].count);
  pool.end();
}

main().catch(e => { console.error(e.message); pool.end(); });