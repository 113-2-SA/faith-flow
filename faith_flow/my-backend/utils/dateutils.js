class DateUtils {
  /**
   * 獲取以星期日為起始的周數
   * @param {Date} date 
   * @returns {number} 周數 (1-53)
   */
  static getWeekNumberSunday(date) {
    const d = new Date(date.valueOf());

    // 調整到本周的星期日（往回推）
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());

    // 獲取年初第一個星期日
    const yearStart = new Date(weekStart.getFullYear(), 0, 1);
    const firstSunday = new Date(weekStart.getFullYear(), 0, 1 + (7 - yearStart.getDay()) % 7);

    if (weekStart < firstSunday) {
      // 落在年初第一個星期日之前，屬於上一年最後一周
      const prevYearStart = new Date(weekStart.getFullYear() - 1, 0, 1);
      const prevFirstSunday = new Date(weekStart.getFullYear() - 1, 0, 1 + (7 - prevYearStart.getDay()) % 7);
      return Math.floor((weekStart - prevFirstSunday) / (7 * 86400000)) + 1;
    }

    return Math.floor((weekStart - firstSunday) / (7 * 86400000)) + 1;
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
   * 獲取本周的年份和周數
   * @returns {{year: number, weekNumber: number}}
   */
  static getCurrentWeek() {
    const today = new Date();
    return {
      year: today.getFullYear(),
      weekNumber: this.getWeekNumberSunday(today)
    };
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