import { Injectable } from '@nestjs/common';
import type { ThreadBotConfig } from '@zalobot/contracts';
import { GroupMemberAccessPolicy } from './group-member-access.policy';
import { PersonalAccessPolicy } from './personal-access.policy';
import type { ThreadAccessKind, ThreadAccessPolicy } from './thread-access-policy';

/** Picks the access strategy for a thread kind; the result is passed to `GrantAccessGuard`. */
@Injectable()
export class ThreadAccessService {
  private readonly policies: Record<ThreadAccessKind, ThreadAccessPolicy> = {
    group: new GroupMemberAccessPolicy(),
    user: new PersonalAccessPolicy(),
  };

  /**
   * `kind` comes from the incoming zca-js message, not `config.threadType`: older rows may still
   * say 'user' for numeric group ids.
   */
  public grantsThreadAccess(
    senderId: string,
    config: ThreadBotConfig,
    kind: ThreadAccessKind,
  ): boolean {
    if (!senderId) return false;
    return this.policies[kind].allows(senderId, config);
  }
}
