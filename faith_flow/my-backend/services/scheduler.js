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
      timezone: "Asia/Taipei" // 使用台北時區
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