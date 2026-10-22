'use client';

import { useId, useMemo, useState } from 'react';
import {
  REMINDER_TARGET_LIMITS,
  REMINDER_TARGET_MODES,
  type IReminderTargetChannel,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { FORM_ERROR_TEXT, FORM_FIELD, FORM_HINT, FORM_LABEL } from '@/shared/ui/form-dialog';
import { useReminderTargetMembersQuery } from '@/modules/reminders/api/reminder-targets-query';
import {
  draftChatId,
  isGroupChannel,
  privateRecipient,
  selfChannelId,
  toggleTargetUser,
  type ReminderTargetDraft,
} from '@/modules/reminders/model/reminder-target';

/** Inline-edit field look of the dashboard tables. */
export const INLINE_EDIT_FIELD =
  'h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100';

interface ReminderTargetFieldsProps {
  value: ReminderTargetDraft;
  onChange: (next: ReminderTargetDraft) => void;
  channels: readonly IReminderTargetChannel[];
  channelsLoading?: boolean;
  /** The saved chat when editing: preselected, and kept selectable if it is no longer listed. */
  savedChat?: { id: string; name?: string };
  /** Table-cell layout (inline edit) instead of the dialog layout. */
  compact?: boolean;
  disabled?: boolean;
  showChannelRequired?: boolean;
  showUsersRequired?: boolean;
}

/**
 * "Send reminder to" → "Who to remind" → (with people) "How to remind": the target of a task
 * reminder or a reminder, in the create dialogs and the inline edits. "Who to remind" is always
 * shown: a group needs at least one picked member, a private chat reminds its own person.
 */
export function ReminderTargetFields({
  value,
  onChange,
  channels,
  channelsLoading = false,
  savedChat,
  compact = false,
  disabled = false,
  showChannelRequired = false,
  showUsersRequired = false,
}: ReminderTargetFieldsProps) {
  const { t } = useLocale();
  const uid = useId();
  const [search, setSearch] = useState('');
  const chatId = draftChatId(value, channels, savedChat?.id);
  const isGroup = isGroupChannel(channels, chatId);
  const membersQuery = useReminderTargetMembersQuery(chatId, isGroup);
  const field = compact ? INLINE_EDIT_FIELD : FORM_FIELD;
  const label = compact ? 'text-[11px] font-medium text-slate-500 dark:text-slate-400' : FORM_LABEL;
  const hasDefault = !!(savedChat?.id || selfChannelId(channels));
  const savedMissing = !!savedChat && !channels.some((channel) => channel.id === savedChat.id);
  // A saved private chat that is no longer listed still names its person.
  const recipient = isGroup
    ? undefined
    : (privateRecipient(channels, chatId) ??
      (chatId ? { self: false, name: savedChat?.name ?? chatId } : undefined));

  const members = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const list = membersQuery.data ?? [];
    return query ? list.filter((m) => m.name.toLocaleLowerCase().includes(query)) : list;
  }, [membersQuery.data, search]);
  const full = value.userIds.length >= REMINDER_TARGET_LIMITS.MAX_USERS;

  return (
    <div className={compact ? 'grid gap-1 text-left' : 'grid gap-3'}>
      <label className="grid gap-1">
        <span className={label}>
          {t('reminderTarget.channel')}
          {!hasDefault && <span className="text-rose-500"> *</span>}
        </span>
        <select
          className={field}
          value={chatId ?? ''}
          // A new chat has other members, so the picked people are dropped.
          onChange={(e) => onChange({ ...value, chatId: e.target.value, userIds: [] })}
          aria-invalid={showChannelRequired}
          disabled={disabled || channelsLoading}
        >
          {!chatId && (
            <option value="" disabled>
              {t('reminderTarget.channelPlaceholder')}
            </option>
          )}
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.isSelf
                ? t('reminderTarget.self')
                : `${channel.type === 'group' ? '👥' : '👤'} ${channel.name}`}
            </option>
          ))}
          {savedMissing && savedChat && (
            <option value={savedChat.id}>{savedChat.name ?? savedChat.id}</option>
          )}
        </select>
        {!compact && !channelsLoading && channels.length === 0 && (
          <span className={FORM_HINT}>{t('reminderTarget.noChannels')}</span>
        )}
        {showChannelRequired && (
          <span className={FORM_ERROR_TEXT}>{t('reminderTarget.channelRequired')}</span>
        )}
      </label>

      {isGroup ? (
        <fieldset className="grid min-w-0 gap-1" disabled={disabled}>
          <legend className={`${label} mb-1`}>
            {t('reminderTarget.users')}
            <span className="text-rose-500"> *</span>
            {value.userIds.length > 0 &&
              ` (${value.userIds.length}/${REMINDER_TARGET_LIMITS.MAX_USERS})`}
          </legend>
          <input
            type="search"
            className={field}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('reminderTarget.usersSearch')}
            aria-label={t('reminderTarget.usersSearch')}
          />
          <div
            className={`overflow-y-auto rounded-[2px] border border-slate-200 dark:border-slate-700 ${
              compact ? 'max-h-28' : 'max-h-40'
            }`}
          >
            {membersQuery.isLoading && (
              <p className={`m-0 px-2 py-1.5 ${FORM_HINT}`}>{t('reminderTarget.usersLoading')}</p>
            )}
            {membersQuery.isError && (
              <p className={`m-0 px-2 py-1.5 ${FORM_ERROR_TEXT}`}>
                {t('reminderTarget.usersUnavailable')}
              </p>
            )}
            {membersQuery.isSuccess && members.length === 0 && (
              <p className={`m-0 px-2 py-1.5 ${FORM_HINT}`}>{t('reminderTarget.usersNone')}</p>
            )}
            {members.map((member) => {
              const checked = value.userIds.includes(member.id);
              return (
                <label
                  key={member.id}
                  className="flex min-h-7 cursor-pointer items-center gap-2 px-2 text-[12px] text-slate-700 hover:bg-slate-50 max-[640px]:min-h-10 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && full}
                    onChange={() =>
                      onChange({ ...value, userIds: toggleTargetUser(value.userIds, member.id) })
                    }
                  />
                  <span className="truncate">{member.name}</span>
                </label>
              );
            })}
          </div>
          {showUsersRequired ? (
            <span className={FORM_ERROR_TEXT}>{t('reminderTarget.usersRequired')}</span>
          ) : (
            <span className={FORM_HINT}>
              {full
                ? t('reminderTarget.usersMax', { max: REMINDER_TARGET_LIMITS.MAX_USERS })
                : value.userIds.length === 0 && t('reminderTarget.usersHint')}
            </span>
          )}
        </fieldset>
      ) : (
        <div className="grid gap-1">
          <span className={label}>{t('reminderTarget.users')}</span>
          {recipient ? (
            <>
              <span className="truncate text-[12px] text-slate-700 dark:text-slate-200">
                👤 {recipient.self ? t('reminderTarget.selfPerson') : recipient.name}
              </span>
              {!compact && <span className={FORM_HINT}>{t('reminderTarget.usersPrivate')}</span>}
            </>
          ) : (
            <span className={FORM_HINT}>{t('reminderTarget.usersPickChannel')}</span>
          )}
        </div>
      )}

      {isGroup && value.userIds.length > 0 && (
        <fieldset className="grid gap-1" disabled={disabled}>
          <legend className={`${label} mb-1`}>{t('reminderTarget.mode')}</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {REMINDER_TARGET_MODES.map((mode) => (
              <label
                key={mode}
                className="flex min-h-7 cursor-pointer items-center gap-1.5 text-[12px] text-slate-700 max-[640px]:min-h-10 dark:text-slate-200"
              >
                <input
                  type="radio"
                  name={`${uid}-mode`}
                  checked={value.mode === mode}
                  onChange={() => onChange({ ...value, mode })}
                />
                {t(`reminderTarget.mode.${mode}`)}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
