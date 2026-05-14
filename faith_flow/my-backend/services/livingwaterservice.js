// ============================================================
// livingwaterservice.js
// 活水泉源 — Service 層
// 職責：組裝提示詞、呼叫 Qwen、處理回傳結果
// ============================================================

const axios = require('axios');

// 從環境變數讀取 Qwen 的連線資訊（在 .env 裡設定）
const QWEN_BASE_URL = process.env.QWEN_BASE_URL;

// ── 六大主題對應表 ──────────────────────────────────────────
// 這裡定義每個主題的中文名稱和來源提示
// 之後題庫從資料庫來的時候，source_hint 直接帶入即可
const THEME_MAP = {
  FAITH_SELF:       '信仰與自我認識（個人與天主的關係、靈性成長）',
  SOCIETY_TECH:     '科技與現代社會（AI倫理、數位時代的人性尊嚴）',
  ECONOMY_JUSTICE:  '經濟正義（貧富差距、公平分配、勞動尊嚴）',
  RELATIONSHIP:     '人際關係與愛德實踐（寬恕、陪伴、服務）',
  SUFFERING_HOPE:   '苦難、困境與基督徒的希望',
  CREATION_ENV:     '受造界保護與環境倫理',
};

// ============================================================
// 【功能一】生成信箋
// 在使用者結束對話後呼叫
// 輸入：問題內容、主題、來源提示、對話記錄
// 輸出：{ summary, quote, quote_source, image_prompt }
// ============================================================
const generateLetter = async ({ question, theme, source_hint, conversation }) => {

  // ── System Prompt：告訴 Qwen 它的角色 ──
  const systemPrompt = `你是天好運（Faith Flow）天主教靈性 App 的信箋生成器。

你的任務是在使用者完成一次「活水泉源」對話後，生成一份溫暖、深刻、具個人化的信箋內容。

你引用的知識來源（三源整合，按情境自動選擇最適合者）：
- 禮儀年：教會時節精神、禮儀文本
- 教宗通諭：方濟各教宗及歷任教宗通諭核心洞見（含《願祢受讚頌》《福音的喜樂》《人類新面貌》等）
- 宗教新聞：近年教會回應現代社會的關懷立場

語氣：溫暖但不濫情，精準但不冷漠，如同一位靈修陪伴者寫給信徒的私人信件。
回覆請嚴格使用 JSON 格式，不附任何說明文字。`;

  // ── User Prompt：帶入這次對話的實際內容 ──
  const userPrompt = `## 本次抽卡問題
${question}
（主題：${THEME_MAP[theme] || theme}，來源提示：${source_hint || '天主教靈修傳統'}）

## 使用者與 AI 的完整對話記錄
${conversation}

## 請生成信箋三元件，嚴格輸出 JSON：
{
  "summary": "100-150字，用第二人稱「你」，提煉這次對話的核心洞見與轉折",
  "quote": "20-50字福音，來自禮儀年/教宗通諭/宗教新聞，力道強、耐人尋味",
  "quote_source": "出處，如：《福音的喜樂》第197號 / 路 15:20",
  "image_prompt": "英文，50-80字，象徵性藝術插畫風格，反映問題情感核心，含 soft warm light, watercolor texture, contemplative mood"
}`;

// ── 呼叫 Groq API（暫時代替 Qwen，待 Qwen 穩定後可切換回來）──
const groqApiKey = process.env.GROQ_API_KEY;
const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const response = await axios.post(
  'https://api.groq.com/openai/v1/chat/completions',
  {
    model: groqModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  },
  {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqApiKey}`,
    },
    timeout: 30000, // Groq 很快，30 秒就夠
  }
);

  // ── 解析 Qwen 回傳的 JSON ──────────────────────────────────
  const rawText = response.data.choices[0].message.content;

  // 移除 Qwen 有時會多包的 ```json ``` 符號
  const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const result = JSON.parse(cleaned);

  return result; // { summary, quote, quote_source, image_prompt }
};

// ============================================================
// 【功能二】生成 Qwen 圖片
// 拿信箋裡的 image_prompt 去呼叫 Qwen 圖像生成
// 輸入：image_prompt 字串
// 輸出：圖片 URL 或 base64（依你們 VM 的 Qwen 設定而定）
// ============================================================
// ============================================================
// 【功能二】生成圖片
// 用 Hugging Face Inference API 生成意境圖
// 輸入：image_prompt 字串
// 輸出：圖片的 base64 字串
// ============================================================
const generateImage = async (image_prompt) => {

  const HF_API_TOKEN = process.env.HF_API_TOKEN;

  // 使用 FLUX 模型（免費、品質好、適合藝術風格）
  const MODEL = 'black-forest-labs/FLUX.1-schnell';

  const response = await axios.post(
    `https://router.huggingface.co/hf-inference/models/${MODEL}`,
    {
      inputs: image_prompt,
      parameters: {
        num_inference_steps: 4,   // schnell 模型建議 4 步
        width: 768,
        height: 768,
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${HF_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'image/jpeg',  // ← 加這行
      },
      responseType: 'arraybuffer', // 圖片是二進位資料
      timeout: 60000,
    }
  );

  // 把二進位圖片轉成 base64，前端可以直接用 <Image source={{uri: `data:image/jpeg;base64,${base64}`}} />
  const base64 = Buffer.from(response.data).toString('base64');

  return {
    base64,
    mimeType: 'image/jpeg',
    dataUrl: `data:image/jpeg;base64,${base64}`,
  };
};

// 匯出給 Controller 使用
module.exports = { generateLetter, generateImage };