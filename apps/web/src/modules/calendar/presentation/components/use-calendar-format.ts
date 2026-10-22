'use client';

import { useMemo } from 'react';
import { localeTag, type ICalendarEventItem, type TranslationKey } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { addDays, getEventDuration, toDateKey } from '../../model/calendar-date-utils';

export type SyncTone = 'ok' | 'muted' | 'warn' | 'error';

/** Locale-aware labels shared by every calendar view, so cards and sheets read the same. */
export function useCalendarFormat() {
  const { locale, t } = useLocale();
  const tag = localeTag(locale);

  return useMemo(() => {
    const time = new Intl.DateTimeFormat(tag, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const shortDate = new Intl.DateTimeFormat(tag, { day: '2-digit', month: '2-digit' });
    const dayTitle = new Intl.DateTimeFormat(tag, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const fullDate = new Intl.DateTimeFormat(tag, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const dateTime = new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short' });

    /** "09:00 – 10:30", "Cả ngày", or with dates when the event spans several days. */
    const range = (event: ICalendarEventItem): string => {
      if (!event.startAt) return '';
      const start = new Date(event.startAt);
      const end = event.endAt ? new Date(event.endAt) : start;
      if (event.allDay) {
        const last = addDays(end, -1);
        return toDateKey(last) > toDateKey(start)
          ? `${t('calendar.allDay')} · ${shortDate.format(start)} – ${shortDate.format(last)}`
          : t('calendar.allDay');
      }
      if (toDateKey(start) === toDateKey(end) || end.getTime() === start.getTime()) {
        return end > start ? `${time.format(start)} – ${time.format(end)}` : time.format(start);
      }
      return `${shortDate.format(start)} ${time.format(start)} – ${shortDate.format(end)} ${time.format(end)}`;
    };

    const duration = (event: ICalendarEventItem): string => {
      const value = getEventDuration(event);
      if (!value) return '';
      if ('days' in value) {
        return value.days > 1 ? t('calendar.duration.days', { count: value.days }) : '';
      }
      if (value.hours && value.minutes) {
        return t('calendar.duration.hoursMinutes', { hours: value.hours, minutes: value.minutes });
      }
      if (value.hours) return t('calendar.duration.hours', { count: value.hours });
      return t('calendar.duration.minutes', { count: value.minutes });
    };

    const reminder = (minutes: number): string => {
      if (minutes === 0) return t('calendar.reminders.atStart');
      if (minutes % 1440 === 0) return t('calendar.reminders.days', { count: minutes / 1440 });
      if (minutes % 60 === 0) return t('calendar.reminders.hours', { count: minutes / 60 });
      return t('calendar.reminders.minutes', { count: minutes });
    };

    const sync = (event: ICalendarEventItem): { label: string; tone: SyncTone } | null => {
      if (!event.sync) return null;
      if (event.sync.status === 'local') return { label: t('calendar.sync.local'), tone: 'muted' };
      if (event.sync.status === 'failed')
        return { label: t('calendar.sync.failed'), tone: 'error' };
      if (!event.sync.isCurrentAccount) {
        return { label: t('calendar.sync.otherAccount'), tone: 'warn' };
      }
      if (event.sync.status === 'pending')
        return { label: t('calendar.sync.pending'), tone: 'muted' };
      return { label: t('calendar.sync.synced'), tone: 'ok' };
    };

    const sourceKey: Record<NonNullable<ICalendarEventItem['source']>, TranslationKey> = {
      zalo: 'calendar.source.zalo',
      dashboard: 'calendar.source.dashboard',
      google: 'calendar.source.google',
    };

    /** "Tạo bởi Đạt · trong Gia đình", or the source when the creator is unknown. */
    const origin = (event: ICalendarEventItem): string => {
      const parts: string[] = [];
      if (event.createdByName) {
        parts.push(t('calendar.meta.createdBy', { name: event.createdByName }));
      } else if (event.source) {
        parts.push(t(sourceKey[event.source]));
      }
      if (event.sourceChatName)
        parts.push(t('calendar.meta.inChat', { chat: event.sourceChatName }));
      return parts.join(' · ');
    };

    return {
      time: (value: Date) => time.format(value),
      dayTitle: (value: Date) => dayTitle.format(value),
      fullDate: (value: Date) => fullDate.format(value),
      dateTime: (value: Date) => dateTime.format(value),
      range,
      duration,
      reminder,
      sync,
      origin,
      source: (event: ICalendarEventItem) => (event.source ? t(sourceKey[event.source]) : ''),
    };
  }, [tag, t]);
}

export const SYNC_TONE_CLASS: Record<SyncTone, string> = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  muted:
    'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  warn: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  error:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300',
};
