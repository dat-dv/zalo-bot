import type { ThreadBotConfig } from '@zalobot/contracts';

export type ThreadAccessKind = 'user' | 'group';

/**
 * Strategy for one kind of ZCA thread: does this thread grant the sender access on its own?
 * It only adds access; admins and globally granted users are allowed by `GrantAccessGuard`.
 */
export interface ThreadAccessPolicy {
  allows(senderId: string, config: ThreadBotConfig): boolean;
}
