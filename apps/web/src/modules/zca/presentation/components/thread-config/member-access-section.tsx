'use client';

import {
  THREAD_MEMBER_ACCESS_MODES,
  type ThreadBotConfig,
  type ThreadMemberAccessMode,
  type TranslationKey,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { GroupMemberPicker } from './group-member-picker';

interface MemberAccessSectionProps {
  form: ThreadBotConfig;
  threadId: string;
  onChange: (form: ThreadBotConfig) => void;
}

const MODE_TEXT: Record<ThreadMemberAccessMode, { label: TranslationKey; hint: TranslationKey }> = {
  'granted-users': {
    label: 'zca.memberAccess.mode.grantedUsers',
    hint: 'zca.memberAccess.mode.grantedUsersHint',
  },
  'all-members': {
    label: 'zca.memberAccess.mode.allMembers',
    hint: 'zca.memberAccess.mode.allMembersHint',
  },
  'selected-members': {
    label: 'zca.memberAccess.mode.selectedMembers',
    hint: 'zca.memberAccess.mode.selectedMembersHint',
  },
};

/** Groups only: who may @mention the bot here, on top of admins and globally granted users. */
export function MemberAccessSection({ form, threadId, onChange }: MemberAccessSectionProps) {
  const { t } = useLocale();
  const access = form.memberAccess;
  const setAccess = (patch: Partial<ThreadBotConfig['memberAccess']>) =>
    onChange({ ...form, memberAccess: { ...access, ...patch } });

  return (
    <section className="rounded-[3px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 dark:border-slate-800">
        <span aria-hidden="true" className="text-lg">
          👥
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {t('zca.memberAccess.title')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('zca.memberAccess.description')}
          </p>
        </div>
      </div>
      <fieldset className="mt-4 flex flex-col gap-2">
        <legend className="sr-only">{t('zca.memberAccess.title')}</legend>
        {THREAD_MEMBER_ACCESS_MODES.map((mode) => (
          <label
            className={`flex cursor-pointer items-start gap-2.5 rounded-[3px] border px-3 py-2.5 transition-colors ${
              access.mode === mode
                ? 'border-blue-500 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/40'
                : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60'
            }`}
            key={mode}
          >
            <input
              checked={access.mode === mode}
              className="mt-0.5 size-4 shrink-0 accent-blue-600"
              name={`member-access-${threadId}`}
              onChange={() => setAccess({ mode })}
              type="radio"
              value={mode}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                {t(MODE_TEXT[mode].label)}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {t(MODE_TEXT[mode].hint)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {access.mode === 'selected-members' && (
        <div className="mt-4">
          <GroupMemberPicker
            memberIds={access.memberIds}
            onChange={(memberIds) => setAccess({ memberIds })}
            threadId={threadId}
          />
        </div>
      )}
    </section>
  );
}
