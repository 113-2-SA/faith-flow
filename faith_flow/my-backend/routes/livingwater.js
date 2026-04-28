// ============================================================
// livingwater.js (route)
// 活水泉源 — Route 層
// 職責：定義 API 路徑，連接 Controller
// ============================================================

const express = require('express');
const router = express.Router();
const {
  generateLetterController,
  generateImageController,
  getDailyCardController,
  getWeeklyCardsController,
} = require('../controllers/livingwatercontroller');

// POST /api/livingwater/generate-letter
// 對話結束後生成信箋
router.post('/generate-letter', generateLetterController);

// POST /api/livingwater/generate-image
// 根據 image_prompt 生成圖片
router.post('/generate-image', generateImageController);

// GET /api/livingwater/daily-card
// 取得今日抽卡題目（含金句與圖片）
router.get('/daily-card', getDailyCardController);

// GET /api/livingwater/weekly-cards
// 取得本週五題（給卡冊列表用）
router.get('/weekly-cards', getWeeklyCardsController);

// POST /api/livingwater/chat
// 活水泉源對話（針對問題卡片的引導式對話）
router.post('/chat', async (req, res) => {
  const { question, theme, message, conversation } = req.body;
  if (!message) return res.status(400).json({ ok: false, error: 'message 必填' });

  const groqApiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const systemPrompt = `你是「活水泉源」，一個溫暖的天主教信仰陪伴者。
你正在陪伴使用者探索這個問題：「${question}」
主題：${theme}

規則：
1. 用溫暖、引導式的語氣回應
2. 鼓勵使用者深入思考和分享
3. 可以引用聖經或天主教教導，但保持自然
4. 每次回應2-4句話，不要太長
5. 只使用繁體中文`;

  const userMessage = `對話記錄：\n${conversation}\n\n使用者說：${message}`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 300,
      }),
    });
    const data = await groqRes.json();
    const reply = data.choices?.[0]?.message?.content || '（AI 暫時無法回應）';
    return res.json({ ok: true, reply });
  } catch (err) {
    console.error('[livingwater/chat] failed:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;