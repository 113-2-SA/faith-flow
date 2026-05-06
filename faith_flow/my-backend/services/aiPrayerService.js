// ==================== services/aiPrayerService.js ====================
// AI 禱告歷程追蹤服務（整合於 Node.js，使用 Jina embedding + Mistral AI + pgvector）
//
// 流程：
//   Step 1: processDiary  → 生成 embedding（Jina）+ 情緒分析（Mistral，並行），更新 diary 表，回傳 embedding 向量
//   Step 2: findSimilar   → 用 pgvector 找相似日記（cosine similarity > 0.75）
//   Step 3: analyzeTheme  → 深度主題分析，寫入 prayer_clusters 表

const { Mistral } = require('@mistralai/mistralai');
const axios = require('axios');
const pool = require('../config/database');
const { parseJsonFromLLM } = require('../utils/parseJsonFromLLM');

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

// 回傳 embedding 向量陣列，供 findSimilar 直接使用（避免重複讀 DB）
async function processDiary(diaryId, content, userId, title = '', tags = []) {
  console.log(`🤖 [aiPrayer] Step 1 開始：process-diary (diary_id=${diaryId})`);

  // 標題和標籤一起納入 embedding，讓主題語意更精確
  const tagStr = Array.isArray(tags) && tags.length > 0 ? tags.join(' ') : '';
  const embeddingInput = [title, tagStr, content].filter(Boolean).join('\n');

  const [embedRes, emotionRes] = await Promise.all([
    axios.post(
      'https://api.jina.ai/v1/embeddings',
      { model: 'jina-embeddings-v3', input: [embeddingInput], task: 'text-matching' },
      { headers: { Authorization: `Bearer ${process.env.JINA_API_KEY}`, 'Content-Type': 'application/json' } }
    ),
    mistral.chat.complete({
      model: 'mistral-small-latest',
      maxTokens: 200,
      messages: [{
        role: 'user',
        content: `分析以下祈禱日記的情緒狀態，只回傳 JSON，不要其他文字：
{"emotion_score": 0到1之間的數字（0=非常悲傷/焦慮，1=非常喜悅/平安）, "emotion_label": "一個中文情緒標籤（感恩、平安、焦慮、哀愁、喜悅、渴望、信靠等）"}

日記內容：${content}`
      }]
    })
  ]);

  const embedding = embedRes.data.data[0].embedding;

  let emotion_score = 0.5;
  let emotion_label = '平靜';
  const parsed = parseJsonFromLLM(emotionRes.choices[0].message.content);
  if (parsed) {
    emotion_score = parseFloat(parsed.emotion_score) || 0.5;
    emotion_label = parsed.emotion_label || '平靜';
  } else {
    console.warn(`⚠️  [aiPrayer] 情緒分析 JSON 解析失敗，使用預設值`);
  }

  await pool.query(
    `UPDATE diary
     SET embedding = $1::vector,
         emotion_score = $2::float8,
         emotion_label = $3
     WHERE diary_id = $4 AND user_id = $5`,
    [`[${embedding.join(',')}]`, emotion_score, emotion_label, diaryId, userId]
  );

  console.log(`✅ [aiPrayer] Step 1 完成：emotion_label=${emotion_label}, emotion_score=${emotion_score}`);
  return embedding;
}

// embedding 由 processDiary 回傳直接傳入，省去重複讀 DB
async function findSimilar(diaryId, userId, embedding) {
  console.log(`🤖 [aiPrayer] Step 2 開始：find-similar (diary_id=${diaryId})`);

  const vectorStr = `[${embedding.join(',')}]`;

// pgvector 的 cosine similarity 計算方式是 1 - (embedding <=> query_vector)，所以我們要找 similarity > 0.82（相當於 cosine similarity > 0.75）
  const simRes = await pool.query(
    `SELECT diary_id,
            diary_date,
            1 - (embedding <=> $1::vector) AS similarity
     FROM diary
     WHERE user_id = $2
       AND diary_id != $3
       AND embedding IS NOT NULL
       AND 1 - (embedding <=> $1::vector) > 0.82
     ORDER BY similarity DESC
     LIMIT 10`,
    [vectorStr, userId, diaryId]
  );

  const similar_diaries = simRes.rows;
  const should_analyze = similar_diaries.length >= 2;

  console.log(`✅ [aiPrayer] Step 2 完成：找到 ${similar_diaries.length} 篇相似日記，should_analyze=${should_analyze}`);
  return { similar_diaries, should_analyze };
}

async function analyzeTheme(diaryIds, userId) {
  console.log(`🤖 [aiPrayer] Step 3 開始：analyze-theme (diary_ids=${diaryIds.join(',')})`);

  const { rows: diaries } = await pool.query(
    `SELECT diary_id, diary_date, diary_title, diary_content, emotion_label, emotion_score
     FROM diary
     WHERE diary_id = ANY($1) AND user_id = $2
     ORDER BY diary_date ASC`,
    [diaryIds, userId]
  );

  if (diaries.length === 0) {
    console.warn(`⚠️  [aiPrayer] 找不到日記內容，跳過主題分析`);
    return;
  }

  // 驗證這些日記是否真的屬於同一個核心主題，避免只是情緒相似卻主題不同
  const titlesSnippet = diaries
    .map((d, i) => `${i + 1}. 「${d.diary_title}」— ${d.diary_content.substring(0, 60)}`)
    .join('\n');

  const coherenceRes = await mistral.chat.complete({
    model: 'mistral-small-latest',
    maxTokens: 10,
    messages: [{
      role: 'user',
      content: `以下幾篇日記是否圍繞同一個核心主題（而非只是情緒類似）？請只回答 YES 或 NO。\n${titlesSnippet}`
    }]
  });

  const coherenceAnswer = coherenceRes.choices[0].message.content.trim().toUpperCase();
  if (!coherenceAnswer.startsWith('YES')) {
    console.log(`ℹ️  [aiPrayer] 主題一致性驗證未通過（${coherenceAnswer}），跳過 cluster 建立`);
    return;
  }

  const diariesText = diaries.map((d, i) =>
    `【日記 ${i + 1}】${d.diary_date}\n標題：${d.diary_title}\n${d.diary_content}`
  ).join('\n\n---\n\n');

  const analysisRes = await mistral.chat.complete({
    model: 'mistral-small-latest',
    maxTokens: 800,
    messages: [{
      role: 'user',
      content: `以下是同一位天主教信友在不同時間寫的數篇祈禱日記，它們有相似的主題。
請進行深度靈修分析，只回傳 JSON，不要其他文字：
{
  "theme": "這些日記的核心主題（10字以內）",
  "emotion_trend": "描述情緒變化的趨勢（例如：從焦慮逐漸走向平安）",
  "ai_insight": "給這位信友的靈修洞察與鼓勵（100字以內，溫暖而有深度）",
  "should_ask_question": true 或 false,
  "question": "反思問題（should_ask_question 為 false 則填 null）"
}

祈禱日記：
${diariesText}`
    }]
  });

  let theme = '靈修主題';
  let emotion_trend = '';
  let ai_insight = '';
  let should_ask_question = false;
  let question = null;

  const parsed = parseJsonFromLLM(analysisRes.choices[0].message.content);
  if (parsed) {
    theme = parsed.theme || theme;
    emotion_trend = parsed.emotion_trend || '';
    ai_insight = parsed.ai_insight || '';
    should_ask_question = !!parsed.should_ask_question;
    question = parsed.question || null;
  } else {
    console.warn(`⚠️  [aiPrayer] 主題分析 JSON 解析失敗，使用預設值`);
  }

  const clusterResult = await pool.query(
    `INSERT INTO prayer_clusters
       (user_id, theme, diary_ids, emotion_trend, ai_insight, should_ask_question, question, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING cluster_id`,
    [userId, theme, diaryIds, emotion_trend, ai_insight, should_ask_question, question]
  );

  const clusterId = clusterResult.rows[0].cluster_id;

  await pool.query(
    `INSERT INTO prayer_nudges (user_id, cluster_id, created_at)
     VALUES ($1, $2, NOW())`,
    [userId, clusterId]
  );

  console.log(`✅ [aiPrayer] Step 3 完成：prayer_cluster 已建立（id=${clusterId}），主題="${theme}"`);
}

async function runAIPrayerPipeline(diaryId, content, userId, title = '', tags = []) {
  console.log(`🚀 [aiPrayer] 開始 AI 禱告歷程流程 (diary_id=${diaryId})`);
  try {
    const embedding = await processDiary(diaryId, content, userId, title, tags);
    const { similar_diaries, should_analyze } = await findSimilar(diaryId, userId, embedding);

    if (should_analyze) {
      const similarIds = similar_diaries.map(d => d.diary_id);
      await analyzeTheme([diaryId, ...similarIds], userId);
    } else {
      console.log(`ℹ️  [aiPrayer] 相似日記不足，跳過主題分析`);
    }

    console.log(`🎉 [aiPrayer] AI 禱告歷程全部完成 (diary_id=${diaryId})`);
  } catch (error) {
    console.error(`❌ [aiPrayer] 流程失敗 (diary_id=${diaryId}):`, error.message);
  }
}

module.exports = { runAIPrayerPipeline, processDiary, findSimilar };
