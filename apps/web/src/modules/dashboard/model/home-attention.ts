import { APP_ROUTES, type IDashboardData } from '@zalobot/contracts';

const DAY_MS = 86_400_000;
/** Same window as the finance digest, so chat and dashboard agree on what is "due soon". */
const DEBT_DUE_WITHIN_MS = 7 * DAY_MS;
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
/** Dashboard date pickers store the picked day as the end of that day in UTC. */
const DATE_ONLY_DUE_TIME = 'T23:59:59.000Z';

export type HomeAttentionKind = 'overdueTasks' | 'tasksDueToday' | 'debtsDue' | 'recurringPending';

export interface HomeAttentionRow {
  kind: HomeAttentionKind;
  count: number;
  /** The most urgent item of the group, so the row says what it is about. */
  firstTitle: string;
  href: string;
}

type HomeAttentionData = Pick<IDashboardData, 'tasks' | 'debts' | 'recurringPending'>;

/** The calendar day of `date` in Vietnam, as `YYYY-MM-DD`. */
export function vietnamDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * The day a due date means. A date picked on the dashboard is stored as 23:59:59 UTC of that day,
 * which is already the next morning in Vietnam; a date from Zalo is a real moment.
 */
export function dueDay(dueAt: string): string | null {
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString();
  return iso.endsWith(DATE_ONLY_DUE_TIME) ? iso.slice(0, 10) : vietnamDay(date);
}

function row(kind: HomeAttentionKind, href: string, titles: readonly string[]): HomeAttentionRow[] {
  const [firstTitle] = titles;
  return firstTitle === undefined ? [] : [{ kind, count: titles.length, firstTitle, href }];
}

/**
 * What needs someone to act now, one row per kind, most urgent first. Only things nobody else will
 * do count: the bot sends reminders by itself, and a task without a due date is never late.
 */
export function buildHomeAttention(data: HomeAttentionData, now: Date): HomeAttentionRow[] {
  const today = vietnamDay(now);
  const openTasks = data.tasks
    .filter((task) => task.status !== 'completed')
    .flatMap((task) => {
      const day = task.dueAt ? dueDay(task.dueAt) : null;
      return day ? [{ day, title: task.title }] : [];
    })
    .sort((a, b) => a.day.localeCompare(b.day));

  const debtsDue = data.debts
    .filter(
      (debt) =>
        !debt.parentDebtId &&
        debt.remainingAmount > 0 &&
        debt.dueAt &&
        Date.parse(debt.dueAt) <= now.getTime() + DEBT_DUE_WITHIN_MS,
    )
    .sort((a, b) => Date.parse(a.dueAt ?? '') - Date.parse(b.dueAt ?? ''));

  return [
    ...row(
      'overdueTasks',
      APP_ROUTES.tasksAllPeriods,
      openTasks.filter((task) => task.day < today).map((task) => task.title),
    ),
    ...row(
      'tasksDueToday',
      APP_ROUTES.tasksAllPeriods,
      openTasks.filter((task) => task.day === today).map((task) => task.title),
    ),
    ...row(
      'debtsDue',
      APP_ROUTES.debts,
      debtsDue.map((debt) => debt.counterparty),
    ),
    ...row(
      'recurringPending',
      APP_ROUTES.recurring,
      data.recurringPending.map((occurrence) => occurrence.note || occurrence.category),
    ),
  ];
}
