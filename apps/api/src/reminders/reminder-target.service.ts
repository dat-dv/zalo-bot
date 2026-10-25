import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  REMINDER_TARGET_LIMITS,
  translate,
  type IReminderTargetChannel,
  type IReminderTargetUser,
  type ReminderTargetMode,
  type SupportedLocale,
} from '@zalobot/contracts';
import { In, Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { DASHBOARD_OWNER_USER_ID } from '../users/dashboard-owner';
import { isLegacyZaloBotId } from '../users/legacy-zalo-bot-id';
import { ZcaMessengerService } from '../zca/zca-messenger.service';
import { ZcaService } from '../zca/zca.service';
import { type ReminderTarget, buildReminderMessage, normalizeTargetUsers } from './reminder-target';
import { OutgoingMemoryKind } from '../zca/memory/memory-kind';

/** Who sets the reminder: the dashboard user, or the sender and chat of a bot message. */
export interface ReminderTargetActor {
  userId?: string;
  /** The chat the bot was asked in; trusted, since the bot answers only where it may. */
  chatId?: string;
}

/** Requested target fields; omitted ones keep the current target (or the default). */
export interface ReminderTargetInput {
  chatId?: string | null;
  /** Picked on the dashboard: must be members of the group, named from its member list. */
  userIds?: readonly string[];
  /** Tagged in a bot message: already real Zalo users with their tag names. */
  users?: readonly IReminderTargetUser[];
  mode?: ReminderTargetMode;
}

/**
 * Default chat when none is given: `origin` = where the bot was asked (task reminders),
 * `self` = the actor's private chat (personal reminders).
 */
export type ReminderTargetDefault = 'origin' | 'self';

export type ReminderDeliveryResult = 'sent' | 'failed' | 'skipped';

/**
 * Whether ZCA can message the user privately. `dashboard-owner` signs in with the fixed code
 * and has no Zalo account; a legacy official-bot id is not a ZCA uid. Neither has a private
 * chat to remind, so they must pick a chat.
 */
export function hasZaloAccount(userId: string | undefined): userId is string {
  return !!userId && userId !== DASHBOARD_OWNER_USER_ID && !isLegacyZaloBotId(userId);
}

/**
 * Where reminders go, shared by task reminders and personal reminders: which chats and
 * group members can be picked, validating a target, and sending to it (one tagged message in
 * the group, or a private message to each person with a tagged group message for failures).
 */
@Injectable()
export class ReminderTargetService {
  private readonly logger = new Logger(ReminderTargetService.name);

  constructor(
    @InjectRepository(ZcaThreadConfigEntity)
    private readonly threadConfigRepo: Repository<ZcaThreadConfigEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @Optional()
    @Inject(forwardRef(() => ZcaService))
    private readonly zcaService?: ZcaService,
    @Optional()
    @Inject(forwardRef(() => ZcaMessengerService))
    private readonly messenger?: ZcaMessengerService,
  ) {}

  /** The user's own private chat (Zalo users only), then every listened thread. */
  public async listChannels(userId: string): Promise<IReminderTargetChannel[]> {
    const selfId = hasZaloAccount(userId) ? userId : undefined;
    const [threads, self] = await Promise.all([
      this.threadConfigRepo.find({
        where: { isListened: true },
        select: { threadId: true, threadName: true, threadType: true },
        order: { threadName: 'ASC' },
      }),
      selfId
        ? this.userRepo.findOne({ where: { id: selfId }, select: { id: true, firstName: true } })
        : Promise.resolve<UserEntity | null>(null),
    ]);
    const channels: IReminderTargetChannel[] = selfId
      ? [{ id: selfId, name: self?.firstName?.trim() || selfId, type: 'user', isSelf: true }]
      : [];
    for (const thread of threads) {
      if (thread.threadId === selfId) continue;
      channels.push({
        id: thread.threadId,
        name: thread.threadName?.trim() || thread.threadId,
        type: thread.threadType === 'group' ? 'group' : 'user',
      });
    }
    return channels;
  }

  /** Members of a listened group that can be reminded; needs ZCA to be logged in. */
  public async listMembers(chatId: string): Promise<IReminderTargetUser[]> {
    const count = await this.threadConfigRepo.count({
      where: { threadId: chatId, threadType: 'group', isListened: true },
    });
    if (count === 0) {
      throw new BadRequestException('Chỉ chọn được người trong nhóm Zalo đang được listen.');
    }
    const result = await this.zcaService?.getGroupMembers(chatId);
    if (!result) {
      throw new BadRequestException('Chưa lấy được thành viên nhóm (ZCA chưa đăng nhập?).');
    }
    return result.members.map((member) => ({
      id: member.id,
      name: member.displayName?.trim() || member.zaloName?.trim() || member.id,
    }));
  }

  /** Display names of chats: thread names, else the user of a private chat. */
  public async chatNames(chatIds: readonly string[]): Promise<Map<string, string>> {
    const ids = [...new Set(chatIds.filter(Boolean))];
    if (ids.length === 0) return new Map();
    const [threads, users] = await Promise.all([
      this.threadConfigRepo.find({
        where: { threadId: In(ids) },
        select: { threadId: true, threadName: true },
      }),
      this.userRepo.find({ where: { id: In(ids) }, select: { id: true, firstName: true } }),
    ]);
    const names = new Map<string, string>();
    for (const user of users) {
      const name = user.firstName?.trim();
      if (name) names.set(user.id, name);
    }
    for (const thread of threads) {
      const name = thread.threadName?.trim();
      if (name) names.set(thread.threadId, name);
    }
    return names;
  }

  /** Whether the bot listens to the thread, so it may be picked as a reminder chat. */
  public async isListenedThread(chatId: string): Promise<boolean> {
    return (
      (await this.threadConfigRepo.count({ where: { threadId: chatId, isListened: true } })) > 0
    );
  }

  /** A group the admin stopped listening to: the bot no longer posts there. */
  public async isUnlistenedGroup(chatId: string): Promise<boolean> {
    const count = await this.threadConfigRepo.count({
      where: { threadId: chatId, threadType: 'group', isListened: false },
    });
    return count > 0;
  }

  /**
   * The target for a create (`current` = null) or an update. The chat is the requested one,
   * else the current one, else the default. A newly chosen chat must be the actor's own
   * private chat, the chat the bot was asked in, or a listened thread. People only exist in a
   * group, which needs at least one: dashboard picks must be its members; moving to another chat
   * drops them. A private chat reminds its own person.
   */
  public async resolve(
    input: ReminderTargetInput,
    current: ReminderTarget | null,
    actor: ReminderTargetActor,
    prefer: ReminderTargetDefault,
  ): Promise<ReminderTarget> {
    const own = hasZaloAccount(actor.userId) ? actor.userId : undefined;
    const fallback = prefer === 'origin' ? actor.chatId || own : own || actor.chatId;
    const chatId = input.chatId?.trim() || current?.chatId || fallback;
    if (!chatId) throw new BadRequestException('Chọn kênh Zalo nhận nhắc.');

    const chatChanged = chatId !== current?.chatId;
    const trusted = chatId === own || chatId === actor.chatId;
    if (chatChanged && !trusted && !(await this.isListenedThread(chatId))) {
      throw new BadRequestException('Kênh nhận nhắc phải là kênh Zalo đang được listen.');
    }

    const isGroup = await this.isGroupChat(chatId);
    let users: IReminderTargetUser[] = [];
    if (isGroup) {
      if (input.users !== undefined) users = normalizeTargetUsers(input.users);
      else if (input.userIds !== undefined) users = await this.pickMembers(chatId, input.userIds);
      else if (!chatChanged) users = current?.users ?? [];
      // A group reminder always tags someone; a private chat reminds its own person.
      if (users.length === 0) {
        throw new BadRequestException('Chọn ít nhất một người được nhắc trong nhóm.');
      }
    }
    // Without people there is nobody to message privately, so the mode is meaningless.
    const keptMode = chatChanged ? undefined : current?.mode;
    const mode: ReminderTargetMode =
      users.length === 0 ? 'mention' : (input.mode ?? keptMode ?? 'mention');
    return { chatId, users, mode };
  }

  /**
   * Sends a reminder to its target: `header`, the tag line (when people are chosen), `body`.
   * `direct` sends each person a private copy; whoever cannot be reached privately is tagged
   * in one group message instead, so nobody misses it.
   */
  public deliver(
    target: ReminderTarget,
    message: { header: string; body: string },
    locale: SupportedLocale,
  ): Promise<ReminderDeliveryResult> {
    // Tagged `reminder`: in the short-term window (for "ok mua rồi"), not in the long-term memory.
    return OutgoingMemoryKind.run('reminder', () => this.deliverTagged(target, message, locale));
  }

  private async deliverTagged(
    target: ReminderTarget,
    message: { header: string; body: string },
    locale: SupportedLocale,
  ): Promise<ReminderDeliveryResult> {
    const messenger = this.messenger;
    if (!messenger) return 'failed';
    // Retrying cannot help: ZCA has no chat with these ids.
    if (target.chatId === DASHBOARD_OWNER_USER_ID || isLegacyZaloBotId(target.chatId)) {
      this.logger.warn(
        `Skipped a reminder addressed to ${target.chatId} (no Zalo account ZCA can message).`,
      );
      return 'skipped';
    }
    if (await this.isUnlistenedGroup(target.chatId)) {
      this.logger.warn(`Skipped a reminder: group ${target.chatId} is not listened.`);
      return 'skipped';
    }

    let tagged = target.users;
    if (target.mode === 'direct' && target.users.length > 0) {
      const chatName = await this.chatName(target.chatId);
      const intro = translate(locale, 'reminderTarget.directIntro', { chat: chatName });
      const failed: IReminderTargetUser[] = [];
      for (const user of target.users) {
        const sent = await messenger.sendMessage(
          user.id,
          `${message.header}\n${intro}\n${message.body}`,
        );
        if (!sent) failed.push(user);
      }
      if (failed.length === 0) return 'sent';
      this.logger.warn(
        `Could not message ${failed.length} people privately; tagging them in ${target.chatId}.`,
      );
      tagged = failed;
    }

    const built = buildReminderMessage(message.header, message.body, tagged);
    const sent =
      built.mentions.length > 0
        ? await messenger.sendMessageWithMentions(target.chatId, built.text, built.mentions)
        : await messenger.sendMessage(target.chatId, built.text);
    return sent ? 'sent' : 'failed';
  }

  private async isGroupChat(chatId: string): Promise<boolean> {
    return (
      (await this.threadConfigRepo.count({ where: { threadId: chatId, threadType: 'group' } })) > 0
    );
  }

  private async chatName(chatId: string): Promise<string> {
    const thread = await this.threadConfigRepo.findOne({
      where: { threadId: chatId },
      select: { threadId: true, threadName: true },
    });
    return thread?.threadName?.trim() || chatId;
  }

  private async pickMembers(
    chatId: string,
    userIds: readonly string[],
  ): Promise<IReminderTargetUser[]> {
    const ids = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
    if (ids.length === 0) return [];
    if (ids.length > REMINDER_TARGET_LIMITS.MAX_USERS) {
      throw new BadRequestException(
        `Chỉ nhắc tối đa ${REMINDER_TARGET_LIMITS.MAX_USERS} người mỗi lần.`,
      );
    }
    const members = new Map((await this.listMembers(chatId)).map((m) => [m.id, m]));
    return ids.map((id) => {
      const member = members.get(id);
      if (!member) throw new BadRequestException('Người được nhắc phải là thành viên của nhóm.');
      return member;
    });
  }
}
