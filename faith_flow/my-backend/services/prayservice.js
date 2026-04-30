// ==================== services/prayerService.js ====================
const { Mistral } = require('@mistralai/mistralai');
const pool = require("../config/database");
const { parseJsonFromLLM } = require('../utils/parseJsonFromLLM');

class PrayerService {
  constructor() {
    this.mistral = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY
    });
  }

  //* ⭐ 主要方法：將祈禱轉換為日記
  async generateTitleAndTags(prayerText) {
    console.log('🤖 [prayerService] 開始生成標題和標籤...');
    
    const prompt = `請分析以下的祈禱內容，提取出：
1. 一個簡短的標題（不超過20字，能概括主題）
2. 1-2個相關標籤

祈禱內容：
${prayerText}

請以 JSON 格式回應，格式如下：
{
  "title": "標題",
  "tags": ["標籤1", "標籤2"]
}`;

    try {
      const message = await this.mistral.chat.complete({
        model: 'mistral-small-latest',
        maxTokens: 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = message.choices[0].message.content;
      console.log('🤖 [prayerService] Mistral 回應:', responseText);
      
      const result = parseJsonFromLLM(responseText);
      if (result) {
        if (!result.tags.includes('祈禱')) {
          result.tags.push('祈禱');
        }
        console.log('✅ [prayerService] 生成成功:', result);
        return result;
      }

      throw new Error('無法從 Mistral 回應中解析 JSON');
    } catch (error) {
      console.error('❌ [prayerService] LLM 生成失敗:', error.message);
      
      // 降級方案：使用前30字作為標題
      const fallbackTitle = prayerText.substring(0, 30) + (prayerText.length > 30 ? '...' : '');
      console.log('⚠️ [prayerService] 使用降級方案，標題:', fallbackTitle);
      
      return {
        title: fallbackTitle,
        tags: ['祈禱']
      };
    }
  }

  /**
   * 可選：從聖經中推薦相關經文
   */
  async generateBibleQuote(prayerText) {
    console.log('📖 [prayerService] 開始生成聖經經文...');
    
    const prompt = `根據以下祈禱內容，推薦一句相關的聖經經文（包含書卷章節）。
請直接回傳經文，不要有任何解釋或前言。

祈禱內容：
${prayerText}

格式範例：
「將你們的一切掛慮都託給他，因為他必關照你們。」（伯多祿前書 5:7）`;

    try {
      const message = await this.mistral.chat.complete({
        model: 'mistral-small-latest',
        maxTokens: 500,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const quote = message.choices[0].message.content.trim();
      console.log('✅ [prayerService] 聖經經文生成成功:', quote);
      return quote;
    } catch (error) {
      console.error('❌ [prayerService] 聖經經文生成失敗:', error.message);
      return null;
    }
  }

  /**
   * ⭐ 將祈禱轉換為日記（直接寫入資料庫）
   * 這個方法獨立於 diaryService，專門處理祈禱轉日記的邏輯
   */
  async convertPrayerToDiary(userId, prayerText, collectId = null) {
    console.log('🔄 [prayerService] 開始轉換祈禱為日記...');
    console.log(`👤 使用者 ID: ${userId}`);
    console.log(`📝 祈禱內容長度: ${prayerText.length} 字`);

    try {
      // 1. 並行生成標題、標籤和聖經經文（節省時間）
      const [titleAndTags, bibleQuote] = await Promise.all([
        this.generateTitleAndTags(prayerText),
        this.generateBibleQuote(prayerText)
      ]);

      const { title, tags } = titleAndTags;

      console.log('📊 [prayerService] AI 生成結果:');
      console.log('  - 標題:', title);
      console.log('  - 標籤:', tags);
      console.log('  - 聖經經文:', bibleQuote);

      // 2. 插入資料庫
      const query = `
        INSERT INTO diary (
          user_id,
          collect_id,
          diary_title,
          diary_content,
          tags,
          bible_quote,
          diary_date,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, NOW())
        RETURNING *
      `;

      const values = [
        userId,
        collectId || null,
        title,
        prayerText,
        JSON.stringify(tags),
        bibleQuote
      ];

      console.log('💾 [prayerService] 準備寫入資料庫...');
      const result = await pool.query(query, values);
      
      const diary = result.rows[0];
      console.log('✅ [prayerService] 日記建立成功! ID:', diary.diary_id);

      return diary;
    } catch (error) {
      console.error('❌ [prayerService] 轉換失敗:', error);
      throw error;
    }
  }

  /**
   * ⭐ 預覽功能：只生成標題和標籤，不儲存
   * 讓使用者在儲存前可以先看到 AI 的建議
   */
  async previewDiary(prayerText) {
    console.log('👁️ [prayerService] 預覽模式：生成標題和標籤');
    
    try {
      const { title, tags } = await this.generateTitleAndTags(prayerText);
      const bibleQuote = await this.generateBibleQuote(prayerText);

      return {
        suggestedTitle: title,
        suggestedTags: tags,
        suggestedBibleQuote: bibleQuote,
        content: prayerText
      };
    } catch (error) {
      console.error('❌ [prayerService] 預覽失敗:', error);
      throw error;
    }
  }
}

module.exports = new PrayerService();