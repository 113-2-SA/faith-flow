const CST_LOCALE = 'zh-TW';
const CST_TIMEZONE = 'Asia/Taipei';

export function toLocaleDateCST(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString(CST_LOCALE, { timeZone: CST_TIMEZONE });
}

export function toDateOnlyCST(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString(CST_LOCALE, {
    timeZone: CST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes}分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小時前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return toLocaleDateCST(dateStr);
}
