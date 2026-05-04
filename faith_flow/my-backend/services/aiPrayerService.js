// ==================== services/aiPrayerService.js ====================
// AI 祈禱分析服務：Node.js 使用 Mistral AI + pgvector
//
// 流程：
//   Step 1: processDiary  → 生成 embedding + 情緒分析，寫入 diary 的 embedding 欄位
//   Step 2: findSimilar   → 用 pgvector 找相似日記（cosine similarity > 0.75）
//   Step 3: analyzeTheme  → 分析主題趨勢，寫入 prayer_clusters 表

// ⚠️ 注意：@mistralai/mistralai 新版只支援 ESM，
// 因此改用 getMistral() helper，每次呼叫時動態 import，避免 require() 報錯。

const pool = require('../config/database');
const { parseJsonFromLLM } = require('../utils/parseJsonFromLLM');

// 🔧 helper：動態載入 Mistral 並建立實例
async function getMistral() {
  const { Mistral } = await import('@mistralai/mistralai');
  return new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
}

// embedding 由 processDiary 產生，findSimilar 直接使用，不重讀 DB
async function processDiary(diaryId, content, userId, title = '', tags = []) {
  console.log(`🔍 [aiPrayer] Step 1 開始：process-diary (diary_id=${diaryId})`);

  // 組合標題、標籤、內容一起做 embedding，增加語意豐富度
  const tagStr = Array.isArray(tags) && tags.length > 0 ? tags.join(' ') : '';
  const embeddingInput = [title, tagStr, content].filter(Boolean).join('\n');

  // 每次呼叫時動態取得 mistral 實例
  const mistral = await getMistral();

  const [embedRes, emotionRes] = await Promise.all([
    // 生成向量 embedding（用於 RAG 相似度搜尋）
    mistral.embeddings.create({ model: 'mistral-embed', inputs: [embeddingInput] }),
    // 情緒分析：請 LLM 輸出 emotion_score 和 emotion_label
    mistral.chat.complete({
      model: 'mistral-small-latest',
      maxTokens: 200,
      messages: [{
        role: 'user',
        content: `請分析以下日記內容的情緒，只回傳 JSON，不要有其他文字：
{"emotion_score": 0到1的數字（0=非常負面/悲傷，1=非常正面/喜悅）, "emotion_label": "用一個中文詞描述主要情緒，例如：感恩、平靜、焦慮、喜悅、悲傷"}

日記內容：${content}`
      }]
    })
  ]);

  const embedding = embedRes.data[0].embedding;

  // 解析情緒分析結果
  let emotion_score = 0.5;
  let emotion_label = '平靜';
  const parsed = parseJsonFromLLM(emotionRes.choices[0].message.content);
  if (parsed) {
    emotion_score = parseFloat(parsed.emotion_score) || 0.5;
    emotion_label = parsed.emotion_label || '平靜';
  } else {
    console.warn(`⚠️  [aiPrayer] 無法解析 JSON 情緒結果，使用預設值`);
  }

  // 將 embedding 向量和情緒分析結果寫入資料庫
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

// embedding 由 processDiary 傳入，不重讀 DB
async function findSimilar(diaryId, userId, embedding) {
  console.log(`🔍 [aiPrayer] Step 2 開始：find-similar (diary_id=${diaryId})`);

  const vectorStr = `[${embedding.join(',')}]`;

  // pgvector 用 cosine similarity 計算：1 - (embedding <=> query_vector)
  // 只取 similarity > 0.82 的日記（約等於 cosine similarity > 0.75）
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

  console.log(`✅ [aiPrayer] Step 2 完成：找到 ${similar_diaries.length} 筆相似日記，should_analyze=${should_analyze}`);
  return { similar_diaries, should_analyze };
}

async function analyzeTheme(diaryIds, userId) {
  console.log(`🔍 [aiPrayer] Step 3 開始：analyze-theme (diary_ids=${diaryIds.join(',')})`);

  const { rows: diaries } = await pool.query(
    `SELECT diary_id, diary_date, diary_title, diary_content, emotion_label, emotion_score
     FROM diary
     WHERE diary_id = ANY($1) AND user_id = $2
     ORDER BY diary_date ASC`,
    [diaryIds, userId]
  );

  if (diaries.length === 0) {
    console.warn(`⚠️  [aiPrayer] 查無日記資料，跳過主題分析`);
    return;
  }

  // 每次呼叫時動態取得 mistral 實例
  const mistral = await getMistral();

  // 先做一致性檢查，避免不相關的日記被誤判為同一主題
  const titlesSnippet = diaries
    .map((d, i) => `${i + 1}. 「${d.diary_title}」${d.diary_content.substring(0, 60)}`)
    .join('\n');

  const coherenceRes = await mistral.chat.complete({
    model: 'mistral-small-latest',
    maxTokens: 10,
    messages: [{
      role: 'user',
      content: `請判斷以下幾篇日記是否有共同的主題或情緒模式？只回答 YES 或 NO：\n${titlesSnippet}`
    }]
  });

  const coherenceAnswer = coherenceRes.choices[0].message.content.trim().toUpperCase();
  if (!coherenceAnswer.startsWith('YES')) {
    console.log(`🔕  [aiPrayer] 主題一致性不足（${coherenceAnswer}），跳過 cluster 建立`);
    return;
  }

  const diariesText = diaries.map((d, i) =>
    `日記 ${i + 1}（${d.diary_date}）\n標題：${d.diary_title}\n${d.diary_content}`
  ).join('\n\n---\n\n');

  const analysisRes = await mistral.chat.complete({
    model: 'mistral-small-latest',
    maxTokens: 800,
    messages: [{
      role: 'user',
      content: `請分析以下幾篇日記的共同主題和情緒趨勢，並給予靈性上的洞察與陪伴。
只回傳 JSON，格式如下：
{
  "theme": "用10字內描述共同主題",
  "emotion_trend": "情緒走向描述（例如：從焦慮逐漸轉向平靜）",
  "ai_insight": "對使用者的靈性洞察與陪伴（100字以內，溫暖的語氣）",
  "should_ask_question": true 或 false,
  "question": "如果 should_ask_question 為 false 則填 null"
}

日記內容：
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

  // 寫入 prayer_clusters 表
  const clusterResult = await pool.query(
    `INSERT INTO prayer_clusters
       (user_id, theme, diary_ids, emotion_trend, ai_insight, should_ask_question, question, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING cluster_id`,
    [userId, theme, diaryIds, emotion_trend, ai_insight, should_ask_question, question]
  );

  const clusterId = clusterResult.rows[0].cluster_id;

  // 寫入 prayer_nudges 表（觸發通知）
  await pool.query(
    `INSERT INTO prayer_nudges (user_id, cluster_id, created_at)
     VALUES ($1, $2, NOW())`,
    [userId, clusterId]
  );

  console.log(`✅ [aiPrayer] Step 3 完成：prayer_cluster 已建立 id=${clusterId}，主題="${theme}"`);
}

async function runAIPrayerPipeline(diaryId, content, userId, title = '', tags = []) {
  console.log(`🚀 [aiPrayer] 啟動 AI 祈禱分析流程 (diary_id=${diaryId})`);
  try {
    const embedding = await processDiary(diaryId, content, userId, title, tags);
    const { similar_diaries, should_analyze } = await findSimilar(diaryId, userId, embedding);

    if (should_analyze) {
      const similarIds = similar_diaries.map(d => d.diary_id);
      await analyzeTheme([diaryId, ...similarIds], userId);
    } else {
      console.log(`🔕  [aiPrayer] 相似日記不足，跳過主題分析`);
    }

    console.log(`🎉 [aiPrayer] AI 祈禱分析流程完成 (diary_id=${diaryId})`);
  } catch (error) {
    console.error(`❌ [aiPrayer] 流程失敗 (diary_id=${diaryId}):`, error.message);
  }
}

module.exports = { runAIPrayerPipeline, processDiary, findSimilar };