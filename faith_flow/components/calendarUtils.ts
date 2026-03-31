export type DayCell = {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Sun 起始，回傳 6x7（42格） */
export function buildMonthGrid(viewDate: Date): DayCell[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = firstOfMonth.getDay(); // 0 = Sun

  // grid 起點：退回到當週週日
  const gridStart = new Date(year, month, 1 - firstWeekday);

  const today = startOfDay(new Date());
  const cells: DayCell[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i
    );

    cells.push({
      date: d,
      inMonth: d.getMonth() === month,
      isToday: isSameDay(d, today),
    });
  }

  return cells;
}

export function addMonths(d: Date, diff: number) {
  return new Date(d.getFullYear(), d.getMonth() + diff, 1);
}

export function monthNameEn(d: Date) {
  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  return months[d.getMonth()];
}
