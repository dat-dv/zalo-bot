import { BadRequestException } from '@nestjs/common';
import {
  REMINDER_TIME_LIMITS,
  type ReminderRepeatType,
  isReminderRepeatType,
} from '@zalobot/contracts';
import type { NagRuleInput } from './reminder-schedule';
import type { RequestedReminderTime } from './reminder-times';

/** An optional whole number; `null` turns the value off. */
function optionalCount(value: unknown, name: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  throw new BadRequestException(`${name} is invalid.`);
}

export function optionalRepeatType(value: unknown): ReminderRepeatType | undefined {
  if (value === undefined) return undefined;
  if (isReminderRepeatType(value)) return value;
  throw new BadRequestException('repeatType is invalid.');
}

function optionalWeekdays(value: unknown): number[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new BadRequestException('repeatWeekdays is invalid.');
  return value.map((day: unknown) => {
    if (typeof day !== 'number') throw new BadRequestException('repeatWeekdays is invalid.');
    return day;
  });
}

function isoDate(value: unknown): Date {
  const date = typeof value === 'string' && value.trim() ? new Date(value) : new Date(NaN);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('remindAt is invalid.');
  return date;
}

/** One requested time: an ISO string, or `{ remindAt, repeatType?, repeatWeekdays? }`. */
function requestedTime(value: unknown): RequestedReminderTime {
  if (typeof value === 'string') return { at: isoDate(value) };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException('remindTimes is invalid.');
  }
  const item = value as Record<string, unknown>;
  const repeatType = optionalRepeatType(item.repeatType);
  const repeatWeekdays = optionalWeekdays(item.repeatWeekdays);
  return {
    at: isoDate(item.remindAt),
    ...(repeatType ? { repeat: { repeatType, repeatWeekdays: repeatWeekdays ?? [] } } : {}),
  };
}

/**
 * Requested times of a task or reminder body: the `remindTimes` list (strings or times with
 * their repeat) wins over the single legacy `remindAt`, where `''` clears every time. Neither
 * given = unchanged (undefined).
 */
export function parseRemindTimesBody(
  remindTimes: unknown,
  remindAt: unknown,
): RequestedReminderTime[] | undefined {
  if (remindTimes !== undefined) {
    if (!Array.isArray(remindTimes) || remindTimes.length > REMINDER_TIME_LIMITS.MAX_TIMES) {
      throw new BadRequestException('remindTimes is invalid.');
    }
    return remindTimes.map(requestedTime);
  }
  if (remindAt === undefined) return undefined;
  return remindAt === '' ? [] : [{ at: isoDate(remindAt) }];
}

/**
 * Remind-again fields of a task or reminder body; each is optional, `null` turns it off.
 * Ranges are checked by the services so both share one message.
 */
export function parseNagRuleBody(body: Record<string, unknown>): NagRuleInput {
  return {
    nagEveryMinutes: optionalCount(body.nagEveryMinutes, 'nagEveryMinutes'),
    nagCount: optionalCount(body.nagCount, 'nagCount'),
  };
}
