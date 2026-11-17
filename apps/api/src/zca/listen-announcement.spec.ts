import assert from 'node:assert/strict';
import test from 'node:test';
import type { ThreadBotConfig } from '@zalobot/contracts';
import type { ConfigService } from '@nestjs/config';
import { buildListenAnnouncement, type ListenAnnouncementConfig } from './listen-announcement';
import {
  LISTEN_ANNOUNCE_COOLDOWN_MS,
  ListenAnnouncementService,
} from './listen-announcement.service';
import { OutgoingMemoryKind } from './memory/memory-kind';
import type { ThreadConfigService } from './thread-config.service';
import type { ZcaMessengerService } from './zca-messenger.service';

const group = (
  chatMemory: ListenAnnouncementConfig['chatMemory'],
  triggerPrefixes: string[] = [],
): ListenAnnouncementConfig => ({
  threadType: 'group',
  directInteraction: { enabled: true, triggerPrefixes },
  chatMemory,
});

void test('buildListenAnnouncement explains a group with long-term memory and photo text on', () => {
  const text = buildListenAnnouncement(
    group({ enabled: true, readImageText: true, learnPeople: false }, ['đen ơi', ' ']),
    'Đen',
  );
  assert.match(text, /^👋 Bot đã bắt đầu lắng nghe cuộc trò chuyện này\./);
  assert.match(text, /tag @Đen hoặc bắt đầu tin bằng "đen ơi" rồi nói việc cần làm/);
  assert.match(text, /🧠 Trí nhớ: ĐANG BẬT/);
  assert.match(text, /khoảng 20 giây sau khi ngớt tin; gõ \/sync/);
  assert.match(text, /đọc cả chữ trong ảnh/);
  assert.match(text, /Tin thu hồi trên Zalo thì bot quên/);
  assert.match(text, /📌 Dặn bot điều cần luôn nhớ/);
});

void test('buildListenAnnouncement says memory is off, and how to call the bot in a private chat', () => {
  const off = buildListenAnnouncement(
    group({ enabled: false, readImageText: true, learnPeople: false }),
    'Đen',
  );
  assert.match(off, /🧠 Trí nhớ: ĐANG TẮT\. Bot không lưu tin nhắn/);
  assert.doesNotMatch(off, /chữ trong ảnh/);
  assert.match(off, /tag @Đen rồi nói việc cần làm/);

  const noPhotos = buildListenAnnouncement(
    group({ enabled: true, readImageText: false, learnPeople: false }),
    'Đen',
  );
  assert.doesNotMatch(noPhotos, /chữ trong ảnh/);

  const privateChat = buildListenAnnouncement(
    { ...group({ enabled: false, readImageText: false, learnPeople: false }), threadType: 'user' },
    'Đen',
  );
  assert.match(privateChat, /nhắn thẳng việc cần làm/);
  assert.doesNotMatch(privateChat, /tag @/);
});

function createService(options: { sendResult?: boolean; throws?: boolean } = {}) {
  const sent: Array<{ chatId: string; text: string; kind: string | undefined }> = [];
  let listener: ((config: ThreadBotConfig) => void) | undefined;
  const threadConfigService = {
    onListenStarted: (fn: (config: ThreadBotConfig) => void) => {
      listener = fn;
      return () => {
        listener = undefined;
      };
    },
  } as unknown as ThreadConfigService;
  const messenger = {
    sendMessage: (chatId: string, text: string) => {
      if (options.throws) return Promise.reject(new Error('not logged in'));
      sent.push({ chatId, text, kind: OutgoingMemoryKind.current() });
      return Promise.resolve(options.sendResult ?? true);
    },
  } as unknown as ZcaMessengerService;
  const config = { get: () => 'Đen' } as unknown as ConfigService;
  const service = new ListenAnnouncementService(threadConfigService, messenger, config);
  return { service, sent, fire: (cfg: ThreadBotConfig) => listener?.(cfg) };
}

const config = {
  threadId: 'g-1',
  ...group({ enabled: true, readImageText: true, learnPeople: false }),
} as unknown as ThreadBotConfig;

void test('ListenAnnouncementService posts one system message per start, with a cooldown', async () => {
  const { service, sent } = createService();
  assert.equal(await service.announce(config, 1000), true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].chatId, 'g-1');
  assert.equal(sent[0].kind, 'system', 'kept out of the chat memory');
  assert.match(sent[0].text, /tag @Đen/);

  assert.equal(await service.announce(config, 1000 + LISTEN_ANNOUNCE_COOLDOWN_MS - 1), false);
  assert.equal(sent.length, 1, 'toggled again within the cooldown: no second message');
  assert.equal(await service.announce(config, 1000 + LISTEN_ANNOUNCE_COOLDOWN_MS), true);
  assert.equal(sent.length, 2);
});

void test('ListenAnnouncementService subscribes on bootstrap and never throws on a failed send', async () => {
  const subscribed = createService();
  subscribed.service.onApplicationBootstrap();
  subscribed.fire(config);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(subscribed.sent.length, 1);
  subscribed.service.onModuleDestroy();

  const failing = createService({ throws: true });
  assert.equal(await failing.service.announce(config), false);
  const refused = createService({ sendResult: false });
  assert.equal(await refused.service.announce(config), false);
});
