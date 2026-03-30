const DateUtils = require('../utils/dateutils');
const pool = require('../config/database');

class WeeklySummaryService {
  /**
   * 獲取某周的所有 diary（星期日到星期六）
   * 注意: diary table 使用 user_id (小寫+底線)
   */
  async getDiariesByWeek(user_id, year, weekNumber) {
    const startDate = DateUtils.getWeekStartDate(year, weekNumber);
    const endDate = DateUtils.getWeekEndDate(year, weekNumber);

    const query = `
      SELECT diary_id, diary_title, diary_content, bible_quote, diary_date
      FROM diary
      WHERE user_id = $1 
        AND diary_date >= $2
        AND diary_date <= $3
      ORDER BY diary_date ASC
    `;
    
    const result = await pool.query(query, [user_id, startDate, endDate]);
    return result.rows;
  }

  /**
   * 使用 AI 生成周回顧
   */
  async generateSummary(diaries) {
    if (diaries.length === 0) {
      throw new Error('本周沒有日記，無法生成回顧');
    }

    const prompt = `
以下是用戶上周（星期日到星期六）的日記內容，請生成一篇溫暖的周回顧：

${diaries.map((d, i) => `
### ${this.getWeekdayName(d.diary_date)} (${d.diary_date})
標題: ${d.diary_title}
內容: ${d.diary_content}
聖經金句: ${d.bible_quote || '無'}
`).join('\n')}

請用繁體中文生成:
1. 回顧標題 (簡短有意義，10-20字)
2. 總結內容 (200-300字，溫暖鼓勵的語氣，提及這周的成長、感恩或反思)
3. 挑選一句最適合這周主題的天主教聖經金句

請以 JSON 格式回傳，不要有任何 markdown 標記: 
{
  "title": "標題",
  "content": "內容", 
  "bible_quote": "聖經金句"
}
    `;

    const response = await this.callAI(prompt);
    
    // 移除可能的 markdown 標記
    const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleanResponse);
  }

  /**
   * 保存周回顧
   * weekly_summary table 使用 "user_id" (駝峰式+雙引號)
   */
  async saveWeeklySummary(user_id, year, weekNumber, summaryData, diaries, isAuto = false) {
    const startDate = DateUtils.getWeekStartDate(year, weekNumber);
    const endDate = DateUtils.getWeekEndDate(year, weekNumber);

    const query = `
      INSERT INTO "weekly_summary" 
        ("user_id", "year", "week_number", "summary_title", "summary_content", 
         "bible_quote", "diary_count", "start_date", "end_date", "is_auto_generated")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT ("user_id", "year", "week_number") 
      DO UPDATE SET 
        "summary_title" = EXCLUDED."summary_title",
        "summary_content" = EXCLUDED."summary_content",
        "bible_quote" = EXCLUDED."bible_quote",
        "diary_count" = EXCLUDED."diary_count",
        "generated_at" = CURRENT_TIMESTAMP,
        "is_auto_generated" = EXCLUDED."is_auto_generated"
      RETURNING *
    `;

    const result = await pool.query(query, [
      user_id,
      year,
      weekNumber,
      summaryData.title,
      summaryData.content,
      summaryData.bible_quote,
      diaries.length,
      startDate,
      endDate,
      isAuto
    ]);

    return result.rows[0];
  }

  /**
   * 自動為所有活躍用戶生成上周回顧
   */
  async autoGenerateWeeklySummaries() {
    const { year, weekNumber } = DateUtils.getLastWeek();
    console.log(`🤖 開始自動生成 ${year} 年第 ${weekNumber} 周的回顧...`);

    // 獲取所有活躍用戶（上周有寫日記的用戶）
    // diary table 使用 user_id (小寫+底線)
    const activeUsersQuery = `
      SELECT DISTINCT user_id
      FROM diary
      WHERE diary_date >= $1 AND diary_date <= $2
    `;
    
    const startDate = DateUtils.getWeekStartDate(year, weekNumber);
    const endDate = DateUtils.getWeekEndDate(year, weekNumber);
    const usersResult = await pool.query(activeUsersQuery, [startDate, endDate]);

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    for (const row of usersResult.rows) {
      const user_id = row.user_id;
      
      try {
        // 檢查是否已經生成過
        const existingQuery = `
          SELECT "summary_id" FROM "weekly_summary"
          WHERE "user_id" = $1 AND "year" = $2 AND "week_number" = $3
        `;
        const existing = await pool.query(existingQuery, [user_id, year, weekNumber]);

        if (existing.rows.length > 0) {
          console.log(`⏭️  用戶 ${user_id} 已有第 ${weekNumber} 周回顧，跳過`);
          results.skipped++;
          continue;
        }

        // 獲取該用戶上周的日記
        const diaries = await this.getDiariesByWeek(user_id, year, weekNumber);

        if (diaries.length === 0) {
          console.log(`📭 用戶 ${user_id} 上周沒有日記，跳過`);
          results.skipped++;
          continue;
        }

        // AI 生成回顧
        const summaryData = await this.generateSummary(diaries);

        // 保存
        await this.saveWeeklySummary(user_id, year, weekNumber, summaryData, diaries, true);

        console.log(`✅ 用戶 ${user_id} 的第 ${weekNumber} 周回顧已生成 (${diaries.length} 篇日記)`);
        results.success++;

        // 防止 API rate limit，加入延遲
        await this.sleep(1000);

      } catch (error) {
        console.error(`❌ 用戶 ${user_id} 生成失敗:`, error.message);
        results.failed++;
        results.errors.push({ user_id, error: error.message });
      }
    }

    console.log(`\n📊 自動生成完成: 成功 ${results.success}, 失敗 ${results.failed}, 跳過 ${results.skipped}`);
    return results;
  }

  /**
   * 獲取星期幾的中文名稱
   */
  getWeekdayName(dateString) {
    const date = new Date(dateString);
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return weekdays[date.getDay()];
  }

  /**
   * 延遲函數（避免 API rate limit）
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 調用 AI API
   */
  async callAI(prompt) {
    const { Mistral } = require('@mistralai/mistralai');
    const client = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY
    });

    const response = await client.chat.complete({
      model: 'mistral-large-latest',
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    return response.choices[0].message.content;
  }
}

module.exports = WeeklySummaryService;