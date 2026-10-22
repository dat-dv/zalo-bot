import { normalizeMemberAccessConfig, type ThreadBotConfig } from '@zalobot/contracts';
import type { ThreadAccessPolicy } from './thread-access-policy';

/** Groups follow `memberAccess`: every member, the selected members, or nobody extra. */
export class GroupMemberAccessPolicy implements ThreadAccessPolicy {
  public allows(senderId: string, config: ThreadBotConfig): boolean {
    const { mode, memberIds } = normalizeMemberAccessConfig(config.memberAccess);
    switch (mode) {
      case 'all-members':
        return true;
      case 'selected-members':
        return memberIds.includes(senderId);
      case 'granted-users':
        return false;
    }
  }
}
