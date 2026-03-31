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
  "quote": "20-50字金句，來自禮儀年/教宗通諭/宗教新聞，力道強、耐人尋味",
  "quote_source": "出處，如：《福音的喜樂》第197號 / 路 15:20",
  "image_prompt": "英文，50-80字，象徵性藝術插畫風格，反映問題情感核心，含 soft warm light, watercolor texture, contemplative mood"
}`;

  // ── 呼叫 Qwen API ──────────────────────────────────────────
  // Qwen 使用 OpenAI 相容格式，所以用 /v1/chat/completions
  const response = await axios.post(
    `${QWEN_BASE_URL}/v1/chat/completions`,
    {
      model: 'qwen2.5:14b', // 確認你們 VM 上跑的模型名稱
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      temperature: 0.7,  // 0=保守固定, 1=創意發散，0.7 是平衡點
      max_tokens: 1000,
    },
    {
      headers: {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
},
      timeout: 300000, // 120 秒 timeout，避免 Qwen 沒回應就一直等
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
const generateImage = async (image_prompt) => {

  // ⚠️ 注意：圖像生成的 API 端點可能和文字不同
  // 請確認你們 VM 上 Qwen 有沒有開圖像生成功能
  // 若沒有，這個函式先保留，之後確認後再填入正確端點
  const response = await axios.post(
    `${QWEN_BASE_URL}/v1/images/generations`,
    {
      model: 'qwen2.5:14b', // 確認你們 VM 上跑的模型名稱, // 先佔位，確認後修改
      prompt: image_prompt,
      n: 1,
      size: '1024x1024',
    },
    {
      headers: {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
},
      timeout: 60000, // 圖片生成比較久，給 60 秒
    }
  );

  return response.data;
};

// 匯出給 Controller 使用
module.exports = { generateLetter, generateImage };