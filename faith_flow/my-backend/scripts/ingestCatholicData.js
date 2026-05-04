// scripts/ingestCatholicData.js
// 一次性腳本：讀取 data/ 下的 JSON 資料，產生 embedding 後存入 DB
// 執行方式：node scripts/ingestCatholicData.js
// 重複執行安全：會跳過已存在的相同 reference

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = require('../config/database');
const { getEmbedding } = require('../services/embeddingService');
const path = require('path');
const fs = require('fs');

const DATA_FILES = [
  path.join(__dirname, '../data/bible_quotes.json'),
  path.join(__dirname, '../data/encyclicals.json'),
];

// 兩次 API 呼叫之間的延遲（毫秒），避免超過 Jina rate limit
const DELAY_MS = 600;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS catholic_knowledge (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      reference TEXT,
      content TEXT NOT NULL,
      author TEXT,
      year TEXT,
      embedding TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('[Ingest] Table catholic_knowledge 已就緒');
}

async function ingestFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const items = JSON.parse(raw);
  console.log(`[Ingest] 讀取 ${path.basename(filePath)}，共 ${items.length} 筆`);

  let inserted = 0;
  let skipped = 0;

  for (const item of items) {
    // 用 reference 做去重判斷
    const existing = await pool.query(
      `SELECT id FROM catholic_knowledge WHERE reference = $1`,
      [item.reference]
    );
    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    try {
      const embedding = await getEmbedding(item.content);
      await pool.query(
        `INSERT INTO catholic_knowledge (category, title, reference, content, author, year, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          item.category,
          item.title,
          item.reference,
          item.content,
          item.author || null,
          item.year || null,
          JSON.stringify(embedding),
        ]
      );
      inserted++;
      process.stdout.write(`  ✓ ${item.reference}\n`);
    } catch (err) {
      console.error(`  ✗ ${item.reference}：${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`[Ingest] ${path.basename(filePath)} 完成：新增 ${inserted}，跳過 ${skipped}`);
}

async function main() {
  console.log('=== 天主教知識庫資料匯入 ===');
  try {
    await ensureTable();
    for (const file of DATA_FILES) {
      await ingestFile(file);
    }
    console.log('=== 匯入完成 ===');
  } catch (err) {
    console.error('[Ingest] 嚴重錯誤：', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
