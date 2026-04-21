require('dotenv').config();
// SSL fix 必須在 require S3Client 之前設定
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const https = require('https');
https.globalAgent.options.rejectUnauthorized = false;
const { setGlobalDispatcher, Agent } = require('undici');
setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }));

const R2Uploader = require('./utils/r2upload');

async function test() {
  console.log('🧪 測試 R2 上傳...');
  console.log('Bucket:', process.env.CLOUDFLARE_R2_BUCKET_NAME);
  console.log('Public URL:', process.env.CLOUDFLARE_R2_PUBLIC_URL);

  // 假音頻 buffer（幾個 bytes 就夠了）
  const fakeAudio = Buffer.from('fake audio data for testing');

  try {
    const url = await R2Uploader.uploadAudio(fakeAudio, 'test/r2-test.mp3');
    console.log('✅ 上傳成功！URL:', url);
  } catch (err) {
    console.error('❌ 上傳失敗:', err.message);
  }
}

test();
