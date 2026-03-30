const cron = require('node-cron');
const DateUtils = require('../utils/dateutils');

class Scheduler {
  constructor(weeklySummaryService) {
    this.weeklySummaryService = weeklySummaryService;
    this.jobs = [];
  }

  /**
   * 啟動所有定時任務
   */
  start() {
    // 每周日凌晨 2:00 執行
    const weeklyJob = cron.schedule('0 2 * * 0', async () => {
      console.log('⏰ 定時任務觸發: 生成每周回顧');
      try {
        await this.weeklySummaryService.autoGenerateWeeklySummaries();
      } catch (error) {
        console.error('定時任務執行失敗:', error);
      }
    }, {
      timezone: "Asia/Taipei"
    });

    this.jobs.push(weeklyJob);
    console.log('✅ 定時任務已啟動: 每周日 02:00 自動生成周回顧');

    // 可選: 每日檢查是否為星期日（備用機制）
    const dailyCheckJob = cron.schedule('0 3 * * *', async () => {
      if (DateUtils.isSunday()) {
        console.log('📅 每日檢查: 今天是星期日，執行周回顧生成');
        try {
          await this.weeklySummaryService.autoGenerateWeeklySummaries();
        } catch (error) {
          console.error('每日檢查執行失敗:', error);
        }
      }
    }, {
      timezone: "Asia/Taipei"
    });

    this.jobs.push(dailyCheckJob);
  }

  /**
   * 伺服器啟動時檢查上周統整是否有遺漏，若有則補生成
   */
  async checkAndBackfillLastWeek() {
    const { year, weekNumber } = DateUtils.getLastWeek();
    const now = new Date();

    // 只在週日結束後（週一以後）才需要補，週日當天讓 cron 自己跑
    if (now.getDay() === 0) {
      console.log('📅 今天是週日，跳過補生成（等 cron job 執行）');
      return;
    }

    console.log(`🔍 啟動檢查：確認 ${year} 年第 ${weekNumber} 周統整是否已生成...`);

    try {
      const results = await this.weeklySummaryService.autoGenerateWeeklySummaries();
      if (results.success > 0) {
        console.log(`✅ 補生成完成：成功 ${results.success} 位用戶`);
      } else if (results.skipped > 0) {
        console.log(`✅ 上周統整皆已存在，無需補生成`);
      }
    } catch (error) {
      console.error('啟動補生成失敗:', error);
    }
  }

  /**
   * 停止所有定時任務
   */
  stop() {
    this.jobs.forEach(job => job.stop());
    console.log('⏹️  定時任務已停止');
  }

  /**
   * 手動觸發周回顧生成（用於測試）
   */
  async triggerManually() {
    console.log('🔧 手動觸發周回顧生成');
    return await this.weeklySummaryService.autoGenerateWeeklySummaries();
  }
}

module.exports = Scheduler;