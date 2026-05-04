// ============================================================
// generateQuestionsAssets.js
// 批次生成腳本：為每道題目生成金句 + image_prompt + 圖片
// 執行方式：node scripts/generateQuestionsAssets.js
// 注意：這個腳本只需要跑一次，結果會存成 JSON 備用
// ============================================================

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ── 設定 ──────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const HF_API_TOKEN = process.env.HF_API_TOKEN;
const HF_MODEL = 'black-forest-labs/FLUX.1-schnell';

// 讀取題庫
const questions = require('./faithflow_questions_100.json');

// 輸出檔案路徑（先存成 JSON，之後再 seed 到 DB）
const OUTPUT_PATH = path.join(__dirname, 'faithflow_questions_with_assets.json');

// ── 主題對應表 ────────────────────────────────────────────
const THEME_MAP = {
  FAITH_SELF:       '信仰與自我認識',
  SOCIETY_TECH:     '科技與現代社會',
  ECONOMY_JUSTICE:  '經濟正義',
  RELATIONSHIP:     '人際與愛德',
  SUFFERING_HOPE:   '苦難與希望',
  CREATION_ENV:     '受造界與環境',
};

// ── Step 1：用 Groq 生成金句 + image_prompt ───────────────
const generateQuoteAndPrompt = async (question) => {
  const prompt = `你是天好運（Faith Flow）天主教靈性 App 的內容設計師。

請根據以下反思題目，生成對應的天主教金句與圖片描述。

題目：${question.question}
主題：${THEME_MAP[question.theme]}
來源提示：${question.source_hint}

請生成：
1. quote：一句來自聖經、教宗通諭或禮儀文本的金句（20-40字），力道強、與題目高度相關
2. quote_source：金句出處（如：瑪 6:34 / 《福音的喜樂》第197號）
3. image_prompt：英文，40-60字，象徵性水彩插畫風格，反映題目的情感核心，含 soft warm light, watercolor texture, contemplative mood，避免直接畫宗教符號

嚴格輸出 JSON，不附任何說明：
{"quote":"...","quote_source":"...","image_prompt":"..."}`;

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    },
    {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const raw = response.data.choices[0].message.content;
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
};

// ── Step 2：用 HuggingFace 生成圖片 ──────────────────────
const generateImage = async (image_prompt) => {
  const response = await axios.post(
    `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`,
    {
      inputs: image_prompt,
      parameters: {
        num_inference_steps: 4,
        width: 768,
        height: 768,
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${HF_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'image/jpeg',
      },
      responseType: 'arraybuffer',
      timeout: 60000,
    }
  );

  return Buffer.from(response.data).toString('base64');
};

// ── 主程式：逐題處理 ──────────────────────────────────────
const main = async () => {
  console.log(`🚀 開始批次生成，共 ${questions.length} 題`);

  // 如果輸出檔已存在，讀取已完成的進度（斷點續跑）
  let results = [];
  if (fs.existsSync(OUTPUT_PATH)) {
    results = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
    console.log(`📂 發現已有進度，從第 ${results.length + 1} 題繼續`);
  }

  const doneIds = new Set(results.map(r => r.id));

  for (const q of questions) {
    // 跳過已完成的題目
    if (doneIds.has(q.id)) {
      console.log(`⏭️  題目 ${q.id} 已完成，跳過`);
      continue;
    }

    console.log(`\n📝 處理題目 ${q.id}/${questions.length}：${q.question.slice(0, 20)}...`);

    try {
      // Step 1：生成金句
      console.log(`  ① 生成金句中...`);
      const { quote, quote_source, image_prompt } = await generateQuoteAndPrompt(q);
      console.log(`  ✅ 金句：${quote.slice(0, 20)}...`);

      // Step 2：生成圖片
      console.log(`  ② 生成圖片中（約 15-30 秒）...`);
      const image_base64 = await generateImage(image_prompt);
      console.log(`  ✅ 圖片生成完成`);

      // 合併結果
      results.push({
        ...q,
        quote,
        quote_source,
        image_prompt,
        image_base64,
        is_ready: true,
      });

      // 每完成一題就存一次（防止中途失敗遺失進度）
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
      console.log(`  💾 已存檔（${results.length}/${questions.length}）`);

      // 避免 API rate limit，每題之間等 2 秒
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (err) {
      console.error(`  ❌ 題目 ${q.id} 失敗：${err.message}`);
      console.log(`  ⏭️  跳過，繼續下一題`);
      // 失敗的題目不存入，下次重跑時會再試
    }
  }

  console.log(`\n🎉 批次生成完成！共 ${results.length} 題有資產`);
  console.log(`📁 輸出檔案：${OUTPUT_PATH}`);
};

main().catch(console.error);// generateQuestionsAssets.js
