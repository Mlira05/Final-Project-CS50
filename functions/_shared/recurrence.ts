// CS50 Final Project — functions/_shared/recurrence.ts: Shared server-side domain or infrastructure module.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
export function monthKey(month: number, year: number) {
  return year * 12 + month;
}

export function randomGroupId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function normalizeIncomeEnd(startMonth: number, startYear: number, endMonth?: number, endYear?: number) {
  const month = endMonth ?? 12;
  const year = endYear ?? startYear;

  if (monthKey(month, year) < monthKey(startMonth, startYear)) {
    throw new Error("A data final da recorrência precisa ser depois do início.");
  }

  return { month, year };
}

export function listMonths(startMonth: number, startYear: number, endMonth: number, endYear: number) {
  const months: Array<{ month: number; year: number }> = [];
  let month = startMonth;
  let year = startYear;

  while (monthKey(month, year) <= monthKey(endMonth, endYear)) {
    months.push({ month, year });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonthsClamped(date: string, offset: number) {
  const [yearText, monthText, dayText] = date.split("-");
  const sourceYear = Number(yearText);
  const sourceMonth = Number(monthText);
  const sourceDay = Number(dayText);
  const zeroBased = sourceYear * 12 + (sourceMonth - 1) + offset;
  const year = Math.floor(zeroBased / 12);
  const month = (zeroBased % 12) + 1;
  const day = Math.min(sourceDay, daysInMonth(year, month));

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function defaultEndOfYearDate(date: string) {
  return `${date.slice(0, 4)}-12-31`;
}

export function listMonthlyDates(startDate: string, endDate: string) {
  if (endDate < startDate) {
    throw new Error("A data final da recorrência precisa ser depois do início.");
  }

  const dates: string[] = [];
  let offset = 0;
  let next = startDate;

  while (next <= endDate) {
    dates.push(next);
    offset += 1;
    next = addMonthsClamped(startDate, offset);
  }

  return dates;
}

