// ============================================================
// livingwatercontroller.js
// 活水泉源 — Controller 層
// ============================================================

const { generateLetter, generateImage } = require('../services/livingwaterservice');
const pool = require('../config/database');
// ✨ chatController 需要的依賴
const mcp = require('../services/magisteriumMcp');
const { findRelevantDiaries } = require('../services/embeddingService');
// ============================================================
// 工具函式：計算本週的開始日期（週一）
// ============================================================
function getWeekStartDate() {
  const now = new Date();
  const day = now.getDay(); // 0=週日, 1=週一...6=週六
  const diff = day === 0 ? -6 : 1 - day; // 往回推到週一
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ============================================================
// 工具函式：用週數當 seed 隨機抽5題（不重複）
// ============================================================
function pickWeeklyQuestions(questions, weekNumber) {
  const seededRandom = (seed) => {
    const x = Math.sin(seed + 1) * 10000;
    return x - Math.floor(x);
  };

  const indexes = [];
  let seed = weekNumber * 100;
  while (indexes.length < 5) {
    const idx = Math.floor(seededRandom(seed) * questions.length);
    if (!indexes.includes(idx)) indexes.push(idx);
    seed++;
  }
  return indexes;
}

// ============================================================
// GET /api/livingwater/weekly-cards
// 取得本週五張卡（如果 DB 沒有就自動建立）
// ============================================================
const getWeeklyCardsController = async (req, res) => {
  try {
    const weekStartDate = getWeekStartDate();

    // 先查看本週是否已經有卡片
    const existing = await pool.query(
      'SELECT wc.weekly_cards_id, wc.day_no, aq.ai_question_id, aq.question_text, aq.theme, aq.quote, aq.quote_source, aq.image_url FROM weekly_cards wc JOIN ai_questions aq ON wc.ai_question_id = aq.ai_question_id WHERE wc.weekly_start_date = $1 ORDER BY wc.day_no',
      [weekStartDate]
    );

    // 本週已有卡片，直接回傳
    if (existing.rows.length === 5) {
      const cards = existing.rows.map(row => ({
        weekly_card_id: row.weekly_cards_id,
        day: row.day_no,
        id: row.ai_question_id,
        question: row.question_text,
        theme: row.theme,
        quote: row.quote,
        quote_source: row.quote_source,
        image_url: row.image_url,
      }));
      return res.status(200).json({ success: true, data: cards });
    }

    // 本週還沒有卡片，從 ai_questions 抽5題並寫入
    console.log('[活水泉源] 本週卡片不存在，開始抽題...');

    // 計算週數（用來當 seed）
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.floor((now - startOfYear) / (7 * 24 * 60 * 60 * 1000));

    // 取出所有題目
    const allQuestions = await pool.query(
      'SELECT ai_question_id, question_text, theme, quote, quote_source, image_url FROM ai_questions WHERE is_active = true AND is_ready = true ORDER BY ai_question_id'
    );

    if (allQuestions.rows.length < 5) {
      return res.status(500).json({ success: false, message: '題庫題目不足' });
    }

    // 用 seed 抽5題
    const indexes = pickWeeklyQuestions(allQuestions.rows, weekNumber);
    const pickedQuestions = indexes.map(i => allQuestions.rows[i]);

    // 先刪除本週舊資料（避免重複）
    await pool.query(
      'DELETE FROM weekly_cards WHERE weekly_start_date = $1',
      [weekStartDate]
    );

    // 寫入 weekly_cards 表
    const insertedCards = [];
    for (let i = 0; i < pickedQuestions.length; i++) {
      const q = pickedQuestions[i];
      const result = await pool.query(
'INSERT INTO weekly_cards (weekly_start_date, day_no, card_style_id, ai_question_id, created_at) VALUES ($1, $2, 1, $3, NOW()) RETURNING weekly_cards_id',        [weekStartDate, i + 1, q.ai_question_id]
      );
      insertedCards.push({
        weekly_card_id: result.rows[0].weekly_cards_id,
        day: i + 1,
        id: q.ai_question_id,
        question: q.question_text,
        theme: q.theme,
        quote: q.quote,
        quote_source: q.quote_source,
        image_url: q.image_url,
      });
    }

    console.log('[活水泉源] 本週卡片已建立:', insertedCards.length, '張');
    return res.status(200).json({ success: true, data: insertedCards });

  } catch (error) {
    console.error('[活水泉源] getWeeklyCards 錯誤：', error.message);
    return res.status(500).json({ success: false, message: '取得本週題目失敗', error: error.message });
  }
};

// ============================================================
// GET /api/livingwater/daily-card
// 取得今日的卡片（含 image_base64）
// ============================================================
const getDailyCardController = async (req, res) => {
  try {
    const weekStartDate = getWeekStartDate();

    // 今天是第幾天（1=週一 ~ 5=週五）
    const now = new Date();
    const dayOfWeek = now.getDay();
    const dayNo = dayOfWeek === 0 ? 5 : Math.min(dayOfWeek, 5); // 週日算第5天

    const result = await pool.query(
      `SELECT wc.weekly_cards_id, wc.day_no, 
              aq.ai_question_id, aq.question_text, aq.theme, 
              aq.quote, aq.quote_source, aq.image_url, aq.image_prompt
       FROM weekly_cards wc 
       JOIN ai_questions aq ON wc.ai_question_id = aq.ai_question_id
       WHERE wc.weekly_start_date = $1 AND wc.day_no = $2`,
      [weekStartDate, dayNo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '今日卡片不存在，請先呼叫 weekly-cards API' });
    }

    const row = result.rows[0];

    // 讀取 image_base64（從 JSON 題庫暫時補上）
    let image_base64 = null;
    try {
      const questions = require('../scripts/faithflow_questions_with_assets.json');
      const matched = questions.find(q => q.question === row.question_text);
      if (matched) image_base64 = matched.image_base64 || null;
    } catch(e) {
      console.warn('[活水泉源] 讀取 image_base64 失敗:', e.message);
    }

    return res.status(200).json({
      success: true,
      data: {
        weekly_card_id: row.weekly_cards_id,
        id: row.ai_question_id,
        day: row.day_no,
        question: row.question_text,
        theme: row.theme,
        quote: row.quote,
        quote_source: row.quote_source,
        image_url: row.image_url,
        image_prompt: row.image_prompt,
        image_base64,
      }
    });

  } catch (error) {
    console.error('[活水泉源] getDailyCard 錯誤：', error.message);
    return res.status(500).json({ success: false, message: '取得今日題目失敗', error: error.message });
  }
};

// ============================================================
// POST /api/livingwater/record-draw
// 使用者點開卡片時記錄（建立 user_draws 紀錄）
// Body: { weekly_card_id }
// ============================================================
const recordDrawController = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: '請先登入' });

    const { weekly_card_id } = req.body;
    if (!weekly_card_id) {
      return res.status(400).json({ success: false, message: '缺少 weekly_card_id' });
    }

    // 檢查是否已經有記錄（避免重複）
    const existing = await pool.query(
      'SELECT user_draws_id FROM user_draws WHERE user_id = $1 AND weekly_card_id = $2',
      [userId, weekly_card_id]
    );

    if (existing.rows.length > 0) {
      // 已有記錄，直接回傳
      return res.status(200).json({
        success: true,
        data: { user_draws_id: existing.rows[0].user_draws_id, already_drawn: true }
      });
    }

    // 建立新的抽卡記錄
    const result = await pool.query(
      'INSERT INTO user_draws (user_id, weekly_card_id, drawdate, is_completed, created_at) VALUES ($1, $2, CURRENT_DATE, false, NOW()) RETURNING user_draws_id',
      [userId, weekly_card_id]
    );

    return res.status(201).json({
      success: true,
      data: { user_draws_id: result.rows[0].user_draws_id, already_drawn: false }
    });

  } catch (error) {
    console.error('[活水泉源] recordDraw 錯誤：', error.message);
    return res.status(500).json({ success: false, message: '記錄抽卡失敗', error: error.message });
  }
};

// ============================================================
// POST /api/livingwater/complete-draw
// 完成整個流程（到 letter）後標記已完成
// Body: { user_draws_id, summary, letter_quote, letter_quote_source, conversation_id }
// ============================================================
const completeDrawController = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: '請先登入' });

    const { user_draws_id, summary, letter_quote, letter_quote_source, conversation_id } = req.body;
    if (!user_draws_id) {
      return res.status(400).json({ success: false, message: '缺少 user_draws_id' });
    }

    // 更新 user_draws
    const result = await pool.query(
      `UPDATE user_draws 
       SET is_completed = true, 
           summary = $1, 
           letter_quote = $2, 
           letter_quote_source = $3,
           conversation_id = $4
       WHERE user_draws_id = $5 AND user_id = $6
       RETURNING *`,
      [summary || null, letter_quote || null, letter_quote_source || null,
       conversation_id || null, user_draws_id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: '找不到抽卡記錄' });
    }

    const draw = result.rows[0];

    // ✨ 寫入 letters 表並回傳 letter_id
    let letter_id = null;
    try {
      // 取得 card_style_id（從 weekly_cards 取）
      const cardRes = await pool.query(
        `SELECT wc.card_style_id FROM weekly_cards wc
         JOIN user_draws ud ON ud.weekly_card_id = wc.weekly_cards_id
         WHERE ud.user_draws_id = $1`,
        [user_draws_id]
      );
      const card_style_id = cardRes.rows[0]?.card_style_id || 1;

      // 寫入 letters
      const letterRes = await pool.query(
        `INSERT INTO letters (conversation_id, card_style_id, summary_text, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT DO NOTHING
         RETURNING letter_id`,
        [conversation_id || null, card_style_id, summary || null]
      );
      letter_id = letterRes.rows[0]?.letter_id || null;
    } catch (e) {
      console.warn('[活水泉源] 寫入 letters 失敗（不影響主流程）:', e.message);
    }

    return res.status(200).json({
      success: true,
      data: { ...draw, letter_id },
    });

  } catch (error) {
    console.error('[活水泉源] completeDraw 錯誤：', error.message);
    return res.status(500).json({ success: false, message: '更新完成狀態失敗', error: error.message });
  }
};

// ============================================================
// GET /api/livingwater/my-draws
// 取得使用者本週的抽卡狀態
// ============================================================
const getMyDrawsController = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: '請先登入' });

    const weekStartDate = getWeekStartDate();

    const result = await pool.query(
      `SELECT ud.user_draws_id, ud.weekly_card_id, ud.is_completed, ud.drawdate,
              ud.summary, ud.letter_quote, ud.letter_quote_source, ud.conversation_id,
              wc.day_no, wc.card_style_id,
              l.letter_id
       FROM user_draws ud
       JOIN weekly_cards wc ON ud.weekly_card_id = wc.weekly_cards_id
       LEFT JOIN letters l ON l.conversation_id = ud.conversation_id
       WHERE ud.user_id = $1 AND wc.weekly_start_date = $2`,
      [userId, weekStartDate]
    );

    // ✨ 對有 summary 但沒有 letter_id 的資料，即時補建 letter
    const rows = await Promise.all(result.rows.map(async (row) => {
      if (row.summary && !row.letter_id) {
        try {
          const card_style_id = row.card_style_id || 1;
          const letterRes = await pool.query(
            `INSERT INTO letters (conversation_id, card_style_id, summary_text, created_at)
             VALUES ($1, $2, $3, NOW())
             RETURNING letter_id`,
            [row.conversation_id || null, card_style_id, row.summary]
          );
          row.letter_id = letterRes.rows[0]?.letter_id || null;
          console.log(`[活水泉源] 補建 letter_id=${row.letter_id} for user_draws_id=${row.user_draws_id}`);
        } catch (e) {
          console.warn('[活水泉源] 補建 letter 失敗:', e.message);
        }
      }
      return row;
    }));

    return res.status(200).json({
      success: true,
      data: rows,
      drawn_card_ids: rows.map(r => r.weekly_card_id),
    });

  } catch (error) {
    console.error('[活水泉源] getMyDraws 錯誤：', error.message);
    return res.status(500).json({ success: false, message: '取得抽卡記錄失敗', error: error.message });
  }
};

// ============================================================
// POST /api/livingwater/generate-letter
// ============================================================
const generateLetterController = async (req, res) => {
  try {
    const { question, theme, source_hint, conversation } = req.body;

    if (!question || !theme || !conversation) {
      return res.status(400).json({
        success: false,
        message: '缺少必填欄位：question、theme、conversation 為必填',
      });
    }

    if (typeof conversation !== 'string' || conversation.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'conversation 必須是非空字串',
      });
    }

    const letterData = await generateLetter({ question, theme, source_hint, conversation });

    return res.status(200).json({ success: true, data: letterData });

  } catch (error) {
    console.error('[活水泉源] generateLetter 錯誤：', error.message);

    if (error instanceof SyntaxError) {
      return res.status(502).json({ success: false, message: 'AI 回傳格式異常，請重試' });
    }
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ success: false, message: 'AI 服務暫時無法連線' });
    }

    return res.status(500).json({ success: false, message: '伺服器內部錯誤', error: error.message });
  }
};

// ============================================================
// POST /api/livingwater/generate-image
// ============================================================
const generateImageController = async (req, res) => {
  try {
    const { image_prompt } = req.body;

    if (!image_prompt) {
      return res.status(400).json({ success: false, message: '缺少必填欄位：image_prompt' });
    }

    const imageData = await generateImage(image_prompt);
    return res.status(200).json({ success: true, data: imageData });

  } catch (error) {
    console.error('[活水泉源] generateImage 錯誤：', error.message);
    return res.status(500).json({ success: false, message: '圖片生成失敗', error: error.message });
  }
};

const getLetterController = async (req, res) => {
  try {
    const { letter_id } = req.params;

    // 先取得 letter 基本資料
    const letterResult = await pool.query(
      `SELECT letter_id, card_style_id, summary_text, created_at
       FROM letters WHERE letter_id = $1`,
      [letter_id]
    );

    if (letterResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: '找不到此信箋' });
    }

    const letter = letterResult.rows[0];

    // ✨ 用 summary_text 比對 user_draws → weekly_cards → ai_questions
    // 這是目前唯一可靠的串接方式（因為 conversation_id 都是 null）
    const cardResult = await pool.query(
      `SELECT 
         aq.question_text AS question,
         aq.quote,
         aq.quote_source,
         aq.theme,
         aq.image_url,
         ud.letter_quote,
         ud.letter_quote_source
       FROM user_draws ud
       JOIN weekly_cards wc ON wc.weekly_cards_id = ud.weekly_card_id
       JOIN ai_questions aq ON aq.ai_question_id = wc.ai_question_id
       WHERE ud.summary = $1
       LIMIT 1`,
      [letter.summary_text]
    );

    if (cardResult.rows.length === 0) {
      // fallback：用 card_style_id 找（舊路徑）
      const fallback = await pool.query(
        `SELECT aq.question_text AS question, aq.quote, aq.quote_source, aq.image_url
         FROM ai_questions aq WHERE aq.ai_question_id = $1`,
        [letter.card_style_id]
      );
      const fb = fallback.rows[0] || {};
      return res.status(200).json({
        success: true,
        data: {
          letter_id: letter.letter_id,
          summary_text: letter.summary_text,
          question: fb.question || null,
          quote: fb.quote || null,
          quote_source: fb.quote_source || null,
          image_url: fb.image_url || null,
        }
      });
    }

    const card = cardResult.rows[0];
    return res.status(200).json({
      success: true,
      data: {
        letter_id: letter.letter_id,
        summary_text: letter.summary_text,
        question: card.question,
        // ✨ 優先用 user_draws 的 letter_quote（更精確）
        quote: card.letter_quote || card.quote,
        quote_source: card.letter_quote_source || card.quote_source,
        image_url: card.image_url,
      }
    });

  } catch (error) {
    console.error('[活水泉源] getLetter 錯誤：', error.message);
    return res.status(500).json({ success: false, message: '取得信箋失敗', error: error.message });
  }
};

const chatController = async (req, res) => {
  const { message, question, theme, conversationId } = req.body;
  const userId = req.userId;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'message 不得為空' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const query = message.trim();

  try {
    let convId = conversationId;
    if (convId) {
      const existing = await pool.query(
        `SELECT conversation_id FROM conversations
         WHERE conversation_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
        [convId, userId]
      );
      if (existing.rows.length === 0) convId = null;
      else {
        await pool.query(
          `UPDATE conversations SET updated_at = NOW() WHERE conversation_id = $1`,
          [convId]
        );
      }
    }
    if (!convId) {
      const result = await pool.query(
        `INSERT INTO conversations (user_id, title, status, con_from, created_at, updated_at)
         VALUES ($1, $2, 'active', 'quanyuan', NOW(), NOW())
         RETURNING conversation_id`,
        [userId, question ? question.slice(0, 20) : '活水泉源對話']
      );
      convId = result.rows[0].conversation_id;
    }
    send({ type: 'start', conversationId: convId });

    await pool.query(
      `INSERT INTO messages (conversation_id, ms_role, ms_content, created_at)
       VALUES ($1, 'user', $2, NOW())`,
      [convId, query]
    );

    // 取得對話歷史（最近8則）
    const historyResult = await pool.query(
      `SELECT ms_role, ms_content FROM messages
       WHERE conversation_id = $1 AND deleted_at IS NULL
       ORDER BY created_at ASC LIMIT 8`,
      [convId]
    );
    const history = historyResult.rows.slice(0, -1);

    // 日記 RAG
    let diaryContext = '';
    try {
      if (userId) {
        const diaries = await findRelevantDiaries(userId, query, pool, 3);
        if (diaries.length > 0) {
          const snippets = diaries.map((d, i) =>
            `[日記${i + 1}] ${d.diary_date} - ${d.diary_title}：${d.diary_content.slice(0, 200)}`
          ).join('\n\n');
          diaryContext = `\n\n[使用者相關日記（請參考以個人化回答）]：\n${snippets}`;
        }
      }
    } catch (e) {
      console.warn('[LivingWater Chat] 日記RAG失敗:', e.message);
    }

    // Magisterium（加 5 秒 timeout，超時用 Groq 自身知識）
    let magisterium = { answer: '', citations: [] };
    try {
      magisterium = await Promise.race([
        (async () => {
          const chatResult = await mcp.chat(query);
          return {
            answer: chatResult?.answer || '',
            citations: chatResult?.citations || [],
          };
        })(),
        new Promise((resolve) =>
          setTimeout(() => {
            console.warn('[LivingWater Chat] Magisterium timeout，使用 Groq 自身知識回覆');
            resolve({ answer: '', citations: [] });
          }, 5000)
        ),
      ]);
    } catch (err) {
      console.warn('[LivingWater Chat] Magisterium failed:', err.message);
    }

    // System Prompt（要求引導反思）
    const systemPrompt = `你是「活水泉源」靈修助理，一個溫暖的天主教靈修陪伴者。
你的任務是陪伴使用者深入反思以下靈修問題。

本次靈修問題：${question || query}
靈修主題：${theme || '靈修反思'}

${magisterium.answer ? `【天主教教義參考（Magisterium）】：\n${magisterium.answer}\n\n請結合以上教義內容來回答。` : '請根據天主教傳統靈修知識來回答。'}

【重要回覆原則】：
1. 語氣溫暖、具同理心，像一位耐心的靈修導師
2. 針對使用者的回應給予個人化的回覆，不要重複已說過的內容
3. 每次回覆結尾必須提出一個具體的引導問題，邀請使用者繼續深入反思
4. 不要急著總結或下結論，幫助使用者挖掘更深的感受
5. 使用繁體中文，不得使用簡體字
6. 回覆長度：100-200字（簡潔有力，留空間讓使用者思考）`;

    // 組合訊息（含對話歷史）
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({
        role: h.ms_role === 'user' ? 'user' : 'assistant',
        content: h.ms_content,
      })),
      {
        role: 'user',
        content: diaryContext ? `${query}${diaryContext}` : query,
      },
    ];

    // 串流輸出
    const groqApiKey = process.env.GROQ_API_KEY;
    const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    let aiReply = '';

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: groqModel,
        messages,
        temperature: 0.75,
        max_tokens: 400,
        stream: true,
      }),
    });

    if (groqRes.ok) {
      const reader = groqRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const chunk = line.slice(6).trim();
          if (chunk === '[DONE]') continue;
          try {
            const parsed = JSON.parse(chunk);
            const text = parsed.choices?.[0]?.delta?.content || '';
            if (text) {
              aiReply += text;
              send({ type: 'chunk', text });
            }
          } catch { /* skip */ }
        }
      }
    }

    const citations = magisterium.citations.map(c => ({
      title: c.document_title || '',
      author: c.document_author || '',
      cited_text: c.cited_text || '',
      url: c.source_url || '',
    }));

    await pool.query(
      `INSERT INTO messages (conversation_id, ms_role, ms_content, metadata, created_at)
       VALUES ($1, 'assistant', $2, $3, NOW())`,
      [convId, aiReply, JSON.stringify({ citations })]
    );

    send({ type: 'citations', data: citations });
    send({ type: 'done', conversationId: convId, reply: aiReply });
    res.end();

  } catch (err) {
    console.error('[LivingWater Chat] 錯誤：', err.message);
    send({ type: 'error', message: '活水泉源暫時無法回應，請稍後再試' });
    res.end();
  }
};

// 匯出給 Route 使用
module.exports = {
  generateLetterController,
  generateImageController,
  getLetterController,
  getDailyCardController,
  getWeeklyCardsController,
  recordDrawController,
  completeDrawController,
  getMyDrawsController,
  chatController,
};