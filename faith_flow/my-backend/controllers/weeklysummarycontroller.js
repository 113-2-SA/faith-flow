const pool = require('../config/database');

class WeeklySummaryController {
  constructor(weeklySummaryService, scheduler) {
    this.service = weeklySummaryService;
    this.scheduler = scheduler;
  }

  /**
   * 為當前用戶生成特定周的回顧
   */
  async generateSpecificWeek(req, res) {
    try {
      const { year, weekNumber } = req.body;
      const userID = req.userId; // ⭐ 從 attachUserId middleware 取得

      // 不允許生成當周（尚未結束）
      const DateUtils = require('../utils/dateutils');
      const current = DateUtils.getCurrentWeek();
      if (Number(year) === current.year && Number(weekNumber) === current.weekNumber) {
        return res.status(400).json({
          ok: false,
          error: '當周尚未結束，請於下周再生成本周回顧'
        });
      }

      const diaries = await this.service.getDiariesByWeek(userID, year, weekNumber);

      if (diaries.length === 0) {
        return res.status(404).json({
          ok: false,
          error: '該周沒有日記'
        });
      }

      // 檢查是否已有回顧
      const existingQuery = `
        SELECT "summary_id", "generated_at" FROM "weekly_summary"
        WHERE "user_id" = $1 AND "year" = $2 AND "week_number" = $3
      `;
      const existing = await pool.query(existingQuery, [userID, year, weekNumber]);

      if (existing.rows.length > 0) {
        const generatedAt = existing.rows[0].generated_at;

        // 檢查是否有新日記（在上次生成後才新增的）
        const newDiaryQuery = `
          SELECT COUNT(*) FROM diary
          WHERE user_id = $1 AND created_at > $2
            AND diary_date >= $3 AND diary_date <= $4
        `;
        const startDate = require('../utils/dateutils').getWeekStartDate(year, weekNumber);
        const endDate = require('../utils/dateutils').getWeekEndDate(year, weekNumber);
        const newDiaryResult = await pool.query(newDiaryQuery, [userID, generatedAt, startDate, endDate]);
        const newDiaryCount = parseInt(newDiaryResult.rows[0].count);

        if (newDiaryCount === 0) {
          return res.status(409).json({
            ok: false,
            error: '本週回顧已生成，新增日記後才能重新生成'
          });
        }
      }

      const summaryData = await this.service.generateSummary(diaries);
      const savedSummary = await this.service.saveWeeklySummary(
        userID, year, weekNumber, summaryData, diaries, false
      );

      res.json({
        ok: true,
        data: savedSummary
      });
    } catch (error) {
      console.error('生成周回顧失敗:', error);
      res.status(500).json({ 
        ok: false, 
        error: error.message 
      });
    }
  }

  /**
   * 獲取當前用戶的歷史周回顧列表
   */
  async getWeeklySummaries(req, res) {
    try {
      const userID = req.userId; // ⭐ 從 attachUserId middleware 取得
      const { limit = 10, offset = 0 } = req.query;

      const query = `
        SELECT * FROM "weekly_summary"
        WHERE "user_id" = $1
        ORDER BY "year" DESC, "week_number" DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [userID, limit, offset]);
      
      res.json({
        ok: true,
        data: result.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: result.rowCount
        }
      });
    } catch (error) {
      console.error('獲取周回顧列表失敗:', error);
      res.status(500).json({ 
        ok: false, 
        error: '獲取失敗' 
      });
    }
  }

  /**
   * 獲取特定周的回顧
   */
  async getWeeklySummary(req, res) {
    try {
      const { year, weekNumber } = req.params;
      const userID = req.userId; // ⭐ 從 attachUserId middleware 取得

      const query = `
        SELECT * FROM "weekly_summary"
        WHERE "user_id" = $1 AND "year" = $2 AND "week_number" = $3
      `;

      const result = await pool.query(query, [userID, year, weekNumber]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          ok: false, 
          error: '找不到該周回顧' 
        });
      }

      res.json({
        ok: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('獲取周回顧失敗:', error);
      res.status(500).json({ 
        ok: false, 
        error: '獲取失敗' 
      });
    }
  }

  /**
   * 手動觸發自動生成（僅管理員）
   */
  async manualTrigger(req, res) {
    try {
      // 檢查管理員權限（你需要實作這個檢查）
      // if (!req.user.isAdmin) {
      //   return res.status(403).json({ ok: false, error: '需要管理員權限' });
      // }

      const results = await this.scheduler.triggerManually();
      
      res.json({
        ok: true,
        message: '手動觸發成功',
        results
      });
    } catch (error) {
      console.error('手動觸發失敗:', error);
      res.status(500).json({ 
        ok: false, 
        error: '觸發失敗' 
      });
    }
  }

  /**
   * 為特定周生成語音
   */
  async generateAudioForWeek(req, res) {
    try {
      const { year, weekNumber } = req.params;
      const userID = req.userId;
      console.log(`🎙 開始生成語音 year=${year} week=${weekNumber} user=${userID}`);
      await this.service.generateAudioForWeek(userID, year, weekNumber);
      console.log('✅ 語音生成完成，回傳成功');
      res.json({ ok: true });
    } catch (error) {
      console.error('❌ 語音生成失敗:', error.message);
      res.status(500).json({ ok: false, error: error.message || '語音生成失敗' });
    }
  }

  /**
   * 播放語音（直接從 DB 串流）
   */
  async streamAudio(req, res) {
    try {
      const { year, weekNumber } = req.params;
      const userID = req.userId;
      const result = await pool.query(
        `SELECT "audio_data" FROM "weekly_summary"
         WHERE "user_id" = $1 AND "year" = $2 AND "week_number" = $3`,
        [userID, year, weekNumber]
      );
      if (result.rows.length === 0 || !result.rows[0].audio_data) {
        return res.status(404).json({ ok: false, error: '找不到語音' });
      }
      res.set('Content-Type', 'audio/mpeg');
      res.set('Accept-Ranges', 'bytes');
      res.send(result.rows[0].audio_data);
    } catch (error) {
      console.error('語音串流失敗:', error);
      res.status(500).json({ ok: false, error: '語音串流失敗' });
    }
  }

  /**
   * 刪除特定周回顧
   */
  async deleteWeeklySummary(req, res) {
    try {
      const { year, weekNumber } = req.params;
      const userID = req.userId;

      const query = `
        DELETE FROM "weekly_summary"
        WHERE "user_id" = $1 AND "year" = $2 AND "week_number" = $3
        RETURNING "summary_id"
      `;

      const result = await pool.query(query, [userID, year, weekNumber]);

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          ok: false, 
          error: '找不到該周回顧' 
        });
      }

      res.json({
        ok: true,
        message: '刪除成功'
      });
    } catch (error) {
      console.error('刪除周回顧失敗:', error);
      res.status(500).json({ 
        ok: false, 
        error: '刪除失敗' 
      });
    }
  }
}

module.exports = WeeklySummaryController;