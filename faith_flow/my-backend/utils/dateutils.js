class DateUtils {
  /**
   * 獲取以星期日為起始的周數
   * @param {Date} date 
   * @returns {number} 周數 (1-53)
   */
  static getWeekNumberSunday(date) {
    const target = new Date(date.valueOf());
    const dayNum = (target.getDay() + 6) % 7; // 轉換：星期日=6, 星期一=0
    
    // 調整到該周的星期日
    target.setDate(target.getDate() - dayNum + 6);
    
    // 獲取年初第一個星期日
    const yearStart = new Date(target.getFullYear(), 0, 1);
    const yearStartDay = yearStart.getDay();
    const firstSunday = new Date(target.getFullYear(), 0, 1 + (7 - yearStartDay) % 7);
    
    // 計算周數
    const weekNumber = Math.ceil(((target - firstSunday) / 86400000 + 1) / 7);
    
    return weekNumber;
  }

  /**
   * 獲取某周的起始日期（星期日）
   * @param {number} year 
   * @param {number} weekNumber 
   * @returns {Date}
   */
  static getWeekStartDate(year, weekNumber) {
    const yearStart = new Date(year, 0, 1);
    const yearStartDay = yearStart.getDay();
    const firstSunday = new Date(year, 0, 1 + (7 - yearStartDay) % 7);
    
    const weekStart = new Date(firstSunday);
    weekStart.setDate(firstSunday.getDate() + (weekNumber - 1) * 7);
    
    return weekStart;
  }

  /**
   * 獲取某周的結束日期（星期六）
   * @param {number} year 
   * @param {number} weekNumber 
   * @returns {Date}
   */
  static getWeekEndDate(year, weekNumber) {
    const weekStart = this.getWeekStartDate(year, weekNumber);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return weekEnd;
  }

  /**
   * 檢查今天是否為星期日
   * @returns {boolean}
   */
  static isSunday() {
    return new Date().getDay() === 0;
  }

  /**
   * 獲取上周的年份和周數
   * @returns {{year: number, weekNumber: number}}
   */
  static getLastWeek() {
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    
    return {
      year: lastWeek.getFullYear(),
      weekNumber: this.getWeekNumberSunday(lastWeek)
    };
  }
}

module.exports = DateUtils;