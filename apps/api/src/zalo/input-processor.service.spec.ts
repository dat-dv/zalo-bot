import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { InputProcessor } from './input-processor.service';
import { ZaloService } from './zalo.service';
import { UsersService } from '../users/users.service';
import { ZaloWebhookEventName } from './dto/zalo-webhook.dto';
import { TextInputService } from './text/text-input.service';
import { TextToolFactory } from './text/text-tool.factory';
import { StartToolStrategy } from './text/strategies/start-tool.strategy';
import { HelpToolStrategy } from './text/strategies/help-tool.strategy';
import { EchoToolStrategy } from './text/strategies/echo-tool.strategy';
import { PingToolStrategy } from './text/strategies/ping-tool.strategy';
import { ResetToolStrategy } from './text/strategies/reset-tool.strategy';
import { ConversationToolStrategy } from './text/strategies/conversation-tool.strategy';

interface MockSetup {
  processor: InputProcessor;
  sentMessages: Array<{ chatId: string | number; text: string }>;
}

function createMockSetup(overrides?: {
  allowedUserIds?: string[];
  isAllowed?: boolean;
  cooldownAllowed?: boolean;
}): MockSetup {
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];

  const mockZaloService = {
    sendMessage: (chatId: string | number, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
  } as unknown as ZaloService;

  const mockUsersService = {
    isAllowed: () => (overrides?.isAllowed !== undefined ? overrides.isAllowed : true),
    checkCooldown: () => ({
      allowed: overrides?.cooldownAllowed !== undefined ? overrides.cooldownAllowed : true,
      reason: 'Vui lòng gửi chậm lại.',
    }),
    upsertUser: () => Promise.resolve({} as never),
  } as unknown as UsersService;

  const mockConfigService = {
    get: (key: string) => {
      if (key === 'zalo.allowedUserIds') return overrides?.allowedUserIds || [];
      return undefined;
    },
  } as unknown as ConfigService;

  const startStrategy = new StartToolStrategy(mockZaloService);
  const helpStrategy = new HelpToolStrategy(mockZaloService);
  const echoStrategy = new EchoToolStrategy(mockZaloService);
  const pingStrategy = new PingToolStrategy(mockZaloService);
  const resetStrategy = new ResetToolStrategy(mockZaloService);
  const conversationStrategy = new ConversationToolStrategy(
    mockZaloService,
    mockUsersService,
    mockConfigService,
  );

  const factory = new TextToolFactory(
    startStrategy,
    helpStrategy,
    echoStrategy,
    pingStrategy,
    resetStrategy,
    conversationStrategy,
  );

  const textInputService = new TextInputService(factory);
  const processor = new InputProcessor(mockZaloService, textInputService);

  return { processor, sentMessages };
}

void test('InputProcessor processes /start, /help, /echo, /ping commands', async () => {
  const { processor, sentMessages } = createMockSetup();

  // 1. /start
  await processor.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '/start',
  });
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Chào Đạt!/);

  // 2. /help
  await processor.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '/help',
  });
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /Danh sách lệnh hỗ trợ/);

  // 3. /echo with content
  await processor.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '/echo Xin chào',
  });
  assert.equal(sentMessages.length, 3);
  assert.equal(sentMessages[2].text, 'Bạn vừa nói: Xin chào');

  // 4. /echo without content
  await processor.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '/echo',
  });
  assert.equal(sentMessages.length, 4);
  assert.match(sentMessages[3].text, /Hãy nhập gì đó sau lệnh \/echo/);

  // 5. /ping
  await processor.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '/ping',
  });
  assert.equal(sentMessages.length, 5);
  assert.match(sentMessages[4].text, /Pong!/);
});

void test('InputProcessor processes /reset and /clear commands', async () => {
  const { processor, sentMessages } = createMockSetup();

  await processor.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '/reset',
  });

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Đã làm mới ngữ cảnh/);
});

void test('InputProcessor handles conversational messages and user auth', async () => {
  // Case 1: Unauthorized user
  const unauthorizedSetup = createMockSetup({
    allowedUserIds: ['admin_user'],
    isAllowed: false,
  });
  await unauthorizedSetup.processor.process({
    type: 'text',
    senderId: 'guest_user',
    chatId: 'c1',
    displayName: 'Guest',
    text: 'Cà phê 25k',
  });
  assert.equal(unauthorizedSetup.sentMessages.length, 1);
  assert.match(unauthorizedSetup.sentMessages[0].text, /chưa được cấp quyền/);

  // Case 2: Cooldown triggered
  const cooldownSetup = createMockSetup({
    cooldownAllowed: false,
  });
  await cooldownSetup.processor.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'Ăn tối 100k',
  });
  assert.equal(cooldownSetup.sentMessages.length, 1);
  assert.match(cooldownSetup.sentMessages[0].text, /Vui lòng gửi chậm lại/);

  // Case 3: Success conversational message
  const successSetup = createMockSetup();
  await successSetup.processor.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'Ăn trưa 35k',
  });
  assert.equal(successSetup.sentMessages.length, 1);
  assert.match(successSetup.sentMessages[0].text, /Đã nhận tin nhắn: "Ăn trưa 35k"/);
});

void test('InputProcessor handles image messages with and without caption', async () => {
  const { processor, sentMessages } = createMockSetup();

  // Without caption
  await processor.process({
    type: 'image',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    imageUrl: 'https://photo.zalo.me/bill.jpg',
  });
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Đã nhận ảnh từ bạn/);

  // With caption -> forwards to processText
  await processor.process({
    type: 'image',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    imageUrl: 'https://photo.zalo.me/bill.jpg',
    caption: '/ping',
  });
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /Pong!/);
});

void test('InputProcessor handles voice, sticker, system events and unsupported inputs', async () => {
  const { processor, sentMessages } = createMockSetup();

  // Voice
  await processor.process({
    type: 'voice',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    voiceUrl: 'https://voice.zalo.me/test.mp3',
  });
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Đã nhận tin nhắn thoại/);

  // Sticker
  await processor.process({
    type: 'sticker',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
  });
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /Cảm ơn bạn đã gửi sticker/);

  // Follow event
  await processor.process({
    type: 'event',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    eventName: ZaloWebhookEventName.FOLLOW,
  });
  assert.equal(sentMessages.length, 3);
  assert.match(sentMessages[2].text, /Chào Đạt!/);

  // Unfollow event (no message sent)
  await processor.process({
    type: 'event',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    eventName: ZaloWebhookEventName.UNFOLLOW,
  });
  assert.equal(sentMessages.length, 3);

  // Unsupported
  await processor.process({
    type: 'unsupported',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
  });
  assert.equal(sentMessages.length, 4);
  assert.match(sentMessages[3].text, /chưa được hỗ trợ/);
});

void test('InputProcessor ignores input without senderId for non-events', async () => {
  const { processor, sentMessages } = createMockSetup();

  await processor.process({
    type: 'text',
    senderId: '',
    chatId: '',
    displayName: '',
    text: 'hello',
  });

  assert.equal(sentMessages.length, 0);
});
