'use client';

import type { ITaskReminderChannel } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';

interface TaskReminderChannelOptionsProps {
  channels: readonly ITaskReminderChannel[];
  /** Placeholder option for "nothing picked"; only shown when there is no default chat. */
  showPlaceholder: boolean;
}

/** `<option>`s of a reminder chat `<select>`: the user's private chat first, then groups/chats. */
export function TaskReminderChannelOptions({
  channels,
  showPlaceholder,
}: TaskReminderChannelOptionsProps) {
  const { t } = useLocale();
  return (
    <>
      {showPlaceholder && (
        <option value="" disabled>
          {t('tasks.remind.channelPlaceholder')}
        </option>
      )}
      {channels.map((channel) => (
        <option key={channel.id} value={channel.id}>
          {channel.isSelf
            ? t('tasks.remind.self')
            : `${channel.type === 'group' ? '👥' : '👤'} ${channel.name}`}
        </option>
      ))}
    </>
  );
}
