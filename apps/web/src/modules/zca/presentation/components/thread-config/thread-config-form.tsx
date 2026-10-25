'use client';

import type { ThreadBotConfig } from '@zalobot/contracts';
import type { ThreadKind } from '../../../model/thread-config-form';
import { ChannelNotesSection } from './channel-notes-section';
import { ConfirmationRulesSection } from './confirmation-rules-section';
import { DirectInteractionSection } from './direct-interaction-section';
import { ImageTextMemorySection } from './image-text-memory-section';
import { ListenToggleCard } from './listen-toggle-card';
import { LongTermMemorySection } from './long-term-memory-section';
import { MediaBackupSection } from './media-backup-section';
import { MemberAccessSection } from './member-access-section';
import { ShortTermMemorySection } from './short-term-memory-section';
import { ThreadConfigActionBar } from './thread-config-action-bar';
import { useThreadConfigForm } from './use-thread-config-form';

interface ThreadConfigFormProps {
  config: ThreadBotConfig;
  threadId: string;
  threadName: string;
  threadType: ThreadKind;
}

/** Two columns on wide screens: who the bot answers on the left, what it keeps on the right. */
export function ThreadConfigForm({
  config,
  threadId,
  threadName,
  threadType,
}: ThreadConfigFormProps) {
  const { form, setForm, draft, setDraft, commitDraft, save, status, isSaving } =
    useThreadConfigForm(config, { threadId, threadName, threadType });

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => void save(e)}>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-4">
          <ListenToggleCard
            checked={form.isListened}
            onChange={(isListened) => setForm({ ...form, isListened })}
          />
          <DirectInteractionSection form={form} onChange={setForm} threadType={threadType} />
          {threadType === 'group' && (
            <MemberAccessSection form={form} onChange={setForm} threadId={threadId} />
          )}
          <ConfirmationRulesSection form={form} onChange={setForm} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <MediaBackupSection
            form={form}
            onChange={setForm}
            threadId={threadId}
            threadName={threadName}
          />
          <h2 className="mt-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            🧠 Trí nhớ
          </h2>
          <ChannelNotesSection threadId={threadId} />
          <ShortTermMemorySection
            draft={draft}
            form={form}
            onChange={setForm}
            onDraftChange={setDraft}
            onDraftCommit={commitDraft}
          />
          <LongTermMemorySection
            threadId={threadId}
            draft={draft}
            form={form}
            onChange={setForm}
            onDraftChange={setDraft}
            onDraftCommit={commitDraft}
          />
          <ImageTextMemorySection form={form} onChange={setForm} />
        </div>
      </div>
      <ThreadConfigActionBar isSaving={isSaving} status={status} />
    </form>
  );
}
