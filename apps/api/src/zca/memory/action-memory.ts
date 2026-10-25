import type { ThreadBotConfig } from '@zalobot/contracts';
import type { ChatMemoryService } from './chat-memory.service';

/** The thread config lookup the recorder needs (ThreadConfigService in the app). */
export interface ActionMemoryThreadConfigs {
  findStoredConfig(threadId: string): Promise<ThreadBotConfig | undefined>;
}

export interface DoneAction {
  chatId: string;
  /** Unique per action, e.g. `action:<code>:<createdAt>`. */
  actionId: string;
  /** `users.id` of whoever asked for it. */
  requesterUid: string;
  requesterName: string | null;
  /** Already plain text, e.g. `(đã duyệt) Đã ghi nhớ: …`. */
  text: string;
}

/**
 * Writes something the bot really did to the chat's memory as one `action` row, only when the chat
 * is listened with a memory on. Shared by confirmed tool calls and the actions done at once
 * (notes). Returns quietly when it cannot write; memory must never block the action itself.
 */
export async function recordDoneAction(
  deps: { threadConfigs?: ActionMemoryThreadConfigs; chatMemory?: ChatMemoryService },
  action: DoneAction,
): Promise<void> {
  if (!deps.threadConfigs || !deps.chatMemory || !action.text) return;
  const config = await deps.threadConfigs.findStoredConfig(action.chatId);
  const memory = config?.chatMemory;
  if (!config?.isListened || (!memory?.enabled && !memory?.shortTermEnabled)) return;
  await deps.chatMemory.recordAction(
    action.chatId,
    config.threadType === 'group' ? 'group' : 'user',
    {
      actionId: action.actionId,
      requesterUid: action.requesterUid,
      requesterName: action.requesterName,
      text: action.text,
    },
    { longTerm: memory.enabled },
  );
}
