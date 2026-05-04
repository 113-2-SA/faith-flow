// ============================================================
// seedLivingWater.js
// 將 faithflow_questions_with_assets.json 寫入資料庫
// 執行方式：node scripts/seedLivingWater.js
// ⚠️ 注意：需要 B 先建好 living_water_questions 資料表
// ============================================================

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 資料庫連線
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 讀取已生成的資產檔
const questions = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'faithflow_questions_with_assets.json'),
    'utf8'
  )
);

const main = async () => {
  console.log(`🚀 開始 Seed，共 ${questions.length} 題`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const q of questions) {
      await client.query(
        `INSERT INTO living_water_questions
          (question_id, question, theme, depth, source_hint,
           quote, quote_source, image_prompt, image_base64, is_ready)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (question_id) DO UPDATE SET
           quote = EXCLUDED.quote,
           quote_source = EXCLUDED.quote_source,
           image_prompt = EXCLUDED.image_prompt,
           image_base64 = EXCLUDED.image_base64,
           is_ready = EXCLUDED.is_ready`,
        [
          q.id,
          q.question,
          q.theme,
          q.depth,
          q.source_hint,
          q.quote,
          q.quote_source,
          q.image_prompt,
          q.image_base64,
          q.is_ready,
        ]
      );
      console.log(`  ✅ 題目 ${q.id} 寫入完成`);
    }

    await client.query('COMMIT');
    console.log(`\n🎉 Seed 完成！共寫入 ${questions.length} 題`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed 失敗，已回滾：', err.message);
  } finally {
    client.release();
    await pool.end();
  }
};

main().catch(console.error);