/**
 * Shared stubs for specs that need a `ReminderTargetService`. No tests here: the `.spec.ts`
 * name only keeps it out of the production build.
 */
import type { IZcaGroupMembersResponse } from '@zalobot/contracts';
import type { Repository } from 'typeorm';
import type { UserEntity } from '../database/entities/user.entity';
import type { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import type { ZcaMessengerService } from '../zca/zca-messenger.service';
import type { ZcaService } from '../zca/zca.service';
import { ReminderTargetService } from './reminder-target.service';

type Thread = Pick<ZcaThreadConfigEntity, 'threadId' | 'threadName' | 'threadType' | 'isListened'>;

/** g1 and g3 are listened groups, g2 a group the admin stopped listening to. */
export const TEST_THREADS: Thread[] = [
  { threadId: 'g1', threadName: 'Nhà mình', threadType: 'group', isListened: true },
  { threadId: 'g2', threadName: 'Cũ', threadType: 'group', isListened: false },
  { threadId: 'g3', threadName: 'Công ty', threadType: 'group', isListened: true },
];

/** Members of g1: users 111 (Đạt) and 222 (Trí). */
const MEMBERS: Record<string, IZcaGroupMembersResponse> = {
  g1: {
    members: [
      { id: '111', displayName: 'Đạt' },
      { id: '222', displayName: 'Trí' },
    ],
    totalMembers: 2,
    fetchedAt: 0,
  },
};

/** `zca_thread_configs` stand-in: `count` / `find` / `findOne` by exact field values. */
export function createThreadRepo(threads: readonly Thread[] = TEST_THREADS) {
  const pick = (where: Partial<Thread>) =>
    threads.filter((t) =>
      Object.entries(where).every(([key, value]) => t[key as keyof Thread] === value),
    );
  const repo = {
    count: ({ where }: { where: Partial<Thread> }) => Promise.resolve(pick(where).length),
    find: ({ where }: { where: Partial<Thread> }) => Promise.resolve(pick(where)),
    findOne: ({ where }: { where: Partial<Thread> }) => Promise.resolve(pick(where)[0] ?? null),
  };
  return repo as unknown as Repository<ZcaThreadConfigEntity>;
}

export interface SentMessage {
  chatId: string;
  text: string;
  tagged: string[];
}

/** A `ReminderTargetService` over the test threads and members, recording what it sends. */
export function createTargetService(options: { failPrivate?: string[] } = {}) {
  const sent: SentMessage[] = [];
  const zca = {
    getGroupMembers: (id: string) => Promise.resolve(MEMBERS[id] ?? null),
  };
  const messenger = {
    sendMessage: (chatId: string, text: string) => {
      if (options.failPrivate?.includes(chatId)) return Promise.resolve(false);
      sent.push({ chatId, text, tagged: [] });
      return Promise.resolve(true);
    },
    sendMessageWithMentions: (chatId: string, text: string, mentions: { uid: string }[]) => {
      sent.push({ chatId, text, tagged: mentions.map((m) => m.uid) });
      return Promise.resolve(true);
    },
  };
  const users = { findOne: () => Promise.resolve(null) };
  const service = new ReminderTargetService(
    createThreadRepo(),
    users as unknown as Repository<UserEntity>,
    zca as unknown as ZcaService,
    messenger as unknown as ZcaMessengerService,
  );
  return { service, sent };
}
