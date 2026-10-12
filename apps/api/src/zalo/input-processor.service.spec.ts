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
import { ManageDebtToolStrategy } from './text/strategies/manage-debt-tool.strategy';
import { RecordTransactionToolStrategy } from './text/strategies/record-transaction-tool.strategy';
import { SetReminderToolStrategy } from './text/strategies/set-reminder-tool.strategy';
import { GetReportToolStrategy } from './text/strategies/get-report-tool.strategy';
import { FinanceService } from '../finance/finance.service';
import { RemindersService } from '../reminders/reminders.service';
import { LlmService } from '../llm/llm.service';
import { TransactionConfirmationService } from './transaction-confirmation.service';

interface MockSetup {
  processor: InputProcessor;
  sentMessages: Array<{ chatId: string | number; text: string }>;
}

function createMockSetup(overrides?: {
  allowedUserIds?: string[];
  isAllowed?: boolean;
  cooldownAllowed?: boolean;
  useRealCooldownTracker?: boolean;
}): MockSetup {
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];
  const lastRequestTimes = new Map<string, number>();

  const mockZaloService = {
    sendMessage: (chatId: string | number, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
    sendChatAction: () => Promise.resolve(true),
    startChatAction: () => () => {},
    withChatAction: <T>(_chatId: string | number, fn: () => Promise<T>) => fn(),
  } as unknown as ZaloService;

  const mockUsersService = {
    isAllowed: () => (overrides?.isAllowed !== undefined ? overrides.isAllowed : true),
    checkCooldown: (userId: string | number) => {
      if (overrides?.cooldownAllowed !== undefined) {
        return {
          allowed: overrides.cooldownAllowed,
          reason: 'Vui lòng gửi chậm lại.',
        };
      }
      if (overrides?.useRealCooldownTracker) {
        const strId = userId.toString();
        const now = Date.now();
        const lastTime = lastRequestTimes.get(strId) || 0;
        const timeSinceLast = (now - lastTime) / 1000;
        if (timeSinceLast < 2) {
          const waitSeconds = Math.ceil(2 - timeSinceLast);
          return {
            allowed: false,
            reason: `⏳ Bạn đang gửi tin nhắn quá nhanh. Vui lòng chờ ${waitSeconds} giây trước khi gửi tiếp nhé!`,
            waitSeconds,
          };
        }
        lastRequestTimes.set(strId, now);
        return { allowed: true };
      }
      return { allowed: true };
    },
    upsertUser: () => Promise.resolve({} as never),
  } as unknown as UsersService;

  const _mockConfigService = {
    get: (key: string) => {
      if (key === 'zalo.allowedUserIds') return overrides?.allowedUserIds || [];
      return undefined;
    },
  } as unknown as ConfigService;

  const mockFinanceService = {
    createDebt: () => Promise.resolve({} as never),
    createTransaction: () => Promise.resolve({} as never),
    getSummary: () => Promise.resolve({ income: 0, expense: 0, balance: 0 } as never),
  } as unknown as FinanceService;

  const _mockRemindersService = {
    createReminder: () => Promise.resolve({ remindAt: new Date() } as never),
  } as unknown as RemindersService;

  const mockLlmService = {
    generate: () =>
      Promise.resolve({
        text: 'Đã nhận tin nhắn.',
      }),
  } as unknown as LlmService;

  const startStrategy = new StartToolStrategy(mockZaloService);
  const helpStrategy = new HelpToolStrategy(mockZaloService);
  const echoStrategy = new EchoToolStrategy(mockZaloService);
  const pingStrategy = new PingToolStrategy(mockZaloService);
  const resetStrategy = new ResetToolStrategy(mockZaloService);
  const conversationStrategy = new ConversationToolStrategy(mockZaloService);
  const confirmationService = new TransactionConfirmationService(
    mockZaloService,
    mockFinanceService,
  );
  const manageDebtStrategy = new ManageDebtToolStrategy(mockZaloService, confirmationService);
  const recordTransactionStrategy = new RecordTransactionToolStrategy(
    mockZaloService,
    confirmationService,
  );
  const setReminderStrategy = new SetReminderToolStrategy(mockZaloService, confirmationService);
  const getReportStrategy = new GetReportToolStrategy(mockZaloService, mockFinanceService);

  const factory = new TextToolFactory(
    startStrategy,
    helpStrategy,
    echoStrategy,
    pingStrategy,
    resetStrategy,
    conversationStrategy,
    manageDebtStrategy,
    recordTransactionStrategy,
    setReminderStrategy,
    getReportStrategy,
  );

  const textInputService = new TextInputService(
    factory,
    mockLlmService,
    mockZaloService,
    confirmationService,
  );
  const processor = new InputProcessor(
    mockZaloService,
    textInputService,
    undefined,
    undefined,
    mockUsersService,
  );

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
  // Case 1: Normal user processing
  const userSetup = createMockSetup({
    allowedUserIds: ['admin_user'],
    isAllowed: true,
  });
  await userSetup.processor.process({
    type: 'text',
    senderId: 'guest_user',
    chatId: 'c1',
    displayName: 'Guest',
    text: 'Cà phê 25k',
  });
  assert.equal(userSetup.sentMessages.length, 1);
  assert.equal(userSetup.sentMessages[0].text, 'Đã nhận tin nhắn.');

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
  assert.match(successSetup.sentMessages[0].text, /Đã nhận tin nhắn/);
});

void test('InputProcessor with real cooldown tracker allows first message and blocks rapid second message', async () => {
  const { processor, sentMessages } = createMockSetup({ useRealCooldownTracker: true });

  // First conversational message -> should succeed and NOT trigger cooldown
  await processor.process({
    type: 'text',
    senderId: 'user_123',
    chatId: 'c1',
    displayName: 'Thành viên',
    text: 'Xin chào bot',
  });

  assert.equal(sentMessages.length, 1);
  assert.doesNotMatch(sentMessages[0].text, /Bạn đang gửi tin nhắn quá nhanh/);
  assert.match(sentMessages[0].text, /Đã nhận tin nhắn/);

  // Immediate second message (< 2s) -> triggers rate limit
  await processor.process({
    type: 'text',
    senderId: 'user_123',
    chatId: 'c1',
    displayName: 'Thành viên',
    text: 'Xin chào lần 2',
  });

  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /Bạn đang gửi tin nhắn quá nhanh/);
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

  // With caption containing only bot mention -> does not forward empty text to processText
  await processor.process({
    type: 'image',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    imageUrl: 'https://photo.zalo.me/bill.jpg',
    caption: '[Hình ảnh] @Bot Finance Assistant',
  });
  assert.equal(sentMessages.length, 3);
  assert.match(sentMessages[2].text, /Đã nhận ảnh từ bạn/);
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

void test('InputProcessor handles video input message', async () => {
  const { processor, sentMessages } = createMockSetup();

  await processor.process({
    type: 'video',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    videoUrl: 'https://video.zalo.me/test.mp4',
  });

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Đã nhận video từ bạn/);
});
