const { MsEdgeTTS, OUTPUT_FORMAT, ProsodyOptions } = require('msedge-tts');

const VOICES = {
  female: 'zh-TW-HsiaoChenNeural',
  male: 'zh-TW-YunJheNeural',
};

// 韻律設定（抑揚頓挫）
// rate: 0.5=慢 / 1.0=正常 / 1.5=快
// pitch: '+0Hz' 基準，'+10Hz' 高一點，'-10Hz' 低一點
// volume: 0~100
const PROSODY = new ProsodyOptions();
PROSODY.rate = 0.8;
PROSODY.pitch = '-5Hz';
PROSODY.volume = 100;

/**
 * 將文字轉換為語音 Buffer
 * @param {string} text - 要轉換的文字
 * @param {'male'|'female'} gender - 語音性別，預設 male
 * @returns {Promise<Buffer|null>} MP3 音訊 Buffer，失敗時回傳 null
 */
async function generateAudio(text, gender = 'male') {
  try {
    const voice = VOICES[gender] ?? VOICES.male;
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const chunks = [];
    const { audioStream } = await tts.toStream(text, PROSODY);

    await new Promise((resolve, reject) => {
      audioStream.on('data', (chunk) => chunks.push(chunk));
      audioStream.on('end', resolve);
      audioStream.on('error', reject);
    });

    const audioBuffer = Buffer.concat(chunks);
    console.log(`✅ edge-tts 語音生成完成，大小: ${audioBuffer.length} bytes`);
    return audioBuffer;
  } catch (error) {
    console.error('❌ edge-tts 語音生成失敗:', error.message);
    return null;
  }
}

module.exports = { generateAudio, VOICES, PROSODY };
