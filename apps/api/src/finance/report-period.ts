const VN_OFFSET_MS = 7 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

export const REPORT_PERIODS = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_year',
  'all_time',
] as const;

export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export function isReportPeriod(value: unknown): value is ReportPeriod {
  return typeof value === 'string' && (REPORT_PERIODS as readonly string[]).includes(value);
}

/** `endAt` is exclusive; both bounds are empty only for `all_time`. */
export interface ReportRange {
  startAt: Date | null;
  endAt: Date | null;
  label: string;
}

/** Midnight in Vietnam of the given calendar day; out-of-range days and months roll over. */
function vnDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - VN_OFFSET_MS);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dayLabel(date: Date): string {
  const vn = new Date(date.getTime() + VN_OFFSET_MS);
  return `${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}`;
}

function fullDayLabel(date: Date): string {
  const vn = new Date(date.getTime() + VN_OFFSET_MS);
  return `${dayLabel(date)}/${vn.getUTCFullYear()}`;
}

function monthRange(year: number, month: number, prefix: string): ReportRange {
  const startAt = vnDay(year, month, 1);
  const vn = new Date(startAt.getTime() + VN_OFFSET_MS);
  return {
    startAt,
    endAt: vnDay(year, month + 1, 1),
    label: `${prefix} ${vn.getUTCMonth() + 1}/${vn.getUTCFullYear()}`,
  };
}

function weekRange(mondayAt: Date, prefix: string): ReportRange {
  const endAt = new Date(mondayAt.getTime() + 7 * DAY_MS);
  const lastDay = new Date(endAt.getTime() - DAY_MS);
  return {
    startAt: mondayAt,
    endAt,
    label: `${prefix} (${dayLabel(mondayAt)}–${dayLabel(lastDay)})`,
  };
}

/** Resolves a named period in Vietnam time. Weeks start on Monday. */
export function resolveReportPeriod(period: ReportPeriod, now: Date): ReportRange {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const year = vn.getUTCFullYear();
  const month = vn.getUTCMonth();
  const today = vnDay(year, month, vn.getUTCDate());
  const mondayAt = new Date(today.getTime() - ((vn.getUTCDay() + 6) % 7) * DAY_MS);

  switch (period) {
    case 'today':
      return { startAt: today, endAt: new Date(today.getTime() + DAY_MS), label: 'Hôm nay' };
    case 'yesterday':
      return { startAt: new Date(today.getTime() - DAY_MS), endAt: today, label: 'Hôm qua' };
    case 'this_week':
      return weekRange(mondayAt, 'Tuần này');
    case 'last_week':
      return weekRange(new Date(mondayAt.getTime() - 7 * DAY_MS), 'Tuần trước');
    case 'this_month':
      return monthRange(year, month, 'Tháng');
    case 'last_month':
      return monthRange(year, month - 1, 'Tháng');
    case 'this_year':
      return { startAt: vnDay(year, 0, 1), endAt: vnDay(year + 1, 0, 1), label: `Năm ${year}` };
    case 'all_time':
      return { startAt: null, endAt: null, label: 'Từ trước đến nay' };
  }
}

/** Calendar date `YYYY-MM-DD`, rejecting days that do not exist such as 2026-02-30. */
function parseDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const date = vnDay(year, month, day);
  const vn = new Date(date.getTime() + VN_OFFSET_MS);
  return vn.getUTCMonth() === month && vn.getUTCDate() === day ? date : null;
}

/** Inclusive custom range in Vietnam time; null when a date is invalid or the range is reversed. */
export function resolveReportRange(startDate: string, endDate: string): ReportRange | null {
  const startAt = parseDay(startDate);
  const lastDay = parseDay(endDate);
  if (!startAt || !lastDay || lastDay.getTime() < startAt.getTime()) return null;
  return {
    startAt,
    endAt: new Date(lastDay.getTime() + DAY_MS),
    label: `${fullDayLabel(startAt)}–${fullDayLabel(lastDay)}`,
  };
}
