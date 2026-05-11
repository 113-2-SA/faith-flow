/**
 * uploadImagesToR2.js
 *
 * 功能：從 faithflow_questions_with_assets.json 讀 image_base64
 *       → 上傳到 Cloudflare R2（路徑：aiquestion/Qid{id}.jpg）
 *       → 把 URL 寫入 ai_questions.image_url
 *
 * 執行：cd C:\faith-flow\faith_flow\my-backend && node scripts/uploadImagesToR2.js
 */

const fs   = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');
require('dotenv').config();

const JSON_PATH = path.join(__dirname, 'faithflow_questions_with_assets.json');
const TEMP_DIR  = path.join(__dirname, 'temp_images');

const r2Client = new S3Client({
  region: 'auto',
  endpoint: 'https://' + process.env.CLOUDFLARE_ACCOUNT_ID + '.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId:     process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

const R2_BUCKET   = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const R2_BASE_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL;

const pgPool = new Pool({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log('🚀 開始上傳圖片\n');
  checkEnvVars();

  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

  console.log('📖 讀取題庫：' + JSON_PATH);
  const questions = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  console.log('   共 ' + questions.length + ' 題\n');

  const results = [];

  for (const q of questions) {
    const id = q.id;
    process.stdout.write('題目 ' + String(id).padStart(3, '0') + '... ');

    // 第2、40題已有正確 URL，只更新 DB 格式即可
    const r2Key    = 'aiquestion/Qid' + id + '.jpg';
    const publicUrl = R2_BASE_URL + '/' + r2Key;

    if (!q.image_base64 || q.image_base64.trim() === '') {
      console.log('⚠️  無圖片，跳過');
      results.push({ id, status: 'no_image' });
      continue;
    }

    try {
      // 檢查 R2 是否已有此檔案
      let alreadyUploaded = false;
      try {
        await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: r2Key }));
        alreadyUploaded = true;
      } catch {}

      if (alreadyUploaded) {
        process.stdout.write('✅ R2已存在 ');
      } else {
        // base64 → 暫存 jpg → 上傳 R2
        const localPath = path.join(TEMP_DIR, 'Qid' + id + '.jpg');
        const clean = q.image_base64.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(localPath, Buffer.from(clean, 'base64'));

        await r2Client.send(new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2Key,
          Body: fs.readFileSync(localPath),
          ContentType: 'image/jpeg',
          CacheControl: 'public, max-age=2592000',
        }));
        process.stdout.write('☁️  上傳完成 ');
      }

      // 寫入 ai_questions.image_url
      await pgPool.query(
        'UPDATE ai_questions SET image_url = $1 WHERE ai_question_id = $2',
        [publicUrl, id]
      );
      console.log('→ DB 更新完成');
      results.push({ id, status: 'success', url: publicUrl });

    } catch (err) {
      console.log('❌ 失敗：' + err.message);
      results.push({ id, status: 'error', error: err.message });
    }
  }

  // 清理暫存
  if (fs.existsSync(TEMP_DIR)) fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  console.log('\n🗑️  暫存資料夾已清除');

  // 報告
  const success = results.filter(r => r.status === 'success').length;
  const noImage = results.filter(r => r.status === 'no_image').length;
  const errors  = results.filter(r => r.status === 'error');
  console.log('\n========================================');
  console.log('✅ 成功：' + success + ' 題');
  console.log('⚠️  無圖片：' + noImage + ' 題');
  console.log('❌ 失敗：' + errors.length + ' 題');
  if (errors.length > 0) errors.forEach(e => console.log('   題目' + e.id + '：' + e.error));
  console.log('========================================');

  await pgPool.end();
  console.log('✅ 完成！');
}

function checkEnvVars() {
  const required = ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_R2_ACCESS_KEY_ID',
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY','CLOUDFLARE_R2_BUCKET_NAME',
    'CLOUDFLARE_R2_PUBLIC_URL','DIRECT_URL'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error('❌ 缺少環境變數：\n' + missing.map(k => '   - ' + k).join('\n'));
    process.exit(1);
  }
  console.log('✅ 環境變數檢查通過\n');
}

main().catch(function(err) {
  console.error('💥 未預期錯誤：' + err.message);
  pgPool.end();
  process.exit(1);
});