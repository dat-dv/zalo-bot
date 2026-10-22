import { isReminderListStatus, type ReminderListStatus } from '@zalobot/contracts';

/** URL key of the `/reminders` tab; `upcoming` is the default and is left out of the URL. */
export const REMINDER_LIST_STATUS_PARAM = 'status';

type ReadableParams = Pick<URLSearchParams, 'get'>;

/** Tab shown on `/reminders`; an unknown value falls back to `upcoming`. */
export function reminderListStatusFrom(params: ReadableParams): ReminderListStatus {
  const value = params.get(REMINDER_LIST_STATUS_PARAM);
  return isReminderListStatus(value) ? value : 'upcoming';
}

/** The query string with the tab set, keeping the other params. */
export function writeReminderListStatus(
  params: URLSearchParams,
  status: ReminderListStatus,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  if (status === 'upcoming') next.delete(REMINDER_LIST_STATUS_PARAM);
  else next.set(REMINDER_LIST_STATUS_PARAM, status);
  return next;
}
