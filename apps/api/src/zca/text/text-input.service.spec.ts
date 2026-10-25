import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { TextInputService } from './text-input.service';
import { TextToolFactory } from './text-tool.factory';
import { TextToolType } from './text-tool.enum';
import { WelcomeToolStrategy } from './strategies/welcome-tool.strategy';
import { HelpToolStrategy } from './strategies/help-tool.strategy';
import { EchoToolStrategy } from './strategies/echo-tool.strategy';
import { PingToolStrategy } from './strategies/ping-tool.strategy';
import { ResetToolStrategy } from './strategies/reset-tool.strategy';
import { ConversationToolStrategy } from './strategies/conversation-tool.strategy';
import { ManageDebtToolStrategy } from './strategies/manage-debt-tool.strategy';
import { RecordTransactionToolStrategy } from './strategies/record-transaction-tool.strategy';
import { SetReminderToolStrategy } from './strategies/set-reminder-tool.strategy';
import { GetReportToolStrategy } from './strategies/get-report-tool.strategy';
import { ZcaMessengerService } from '../zca-messenger.service';
import { UsersService } from '../../users/users.service';
import { FinanceService } from '../../finance/finance.service';
import { RemindersService } from '../../reminders/reminders.service';
import { LlmService } from '../../llm/llm.service';
import { LlmResponse } from '../../llm/types/llm.types';
import { TransactionConfirmationService } from '../confirmation/transaction-confirmation.service';
import { CreatePlaceToolStrategy } from './strategies/create-place-tool.strategy';

import { PendingImageActionService } from '../pending-image/pending-image-action.service';
import { OcrService } from '../../ocr/ocr.service';
import { MediaStorageService } from '../../receipt-storage/media-storage.service';
import { ShortTermMemoryService } from '../memory/short-term-memory.service';

interface SetupOptions {
  allowedUserIds?: string[];
  isAllowed?: boolean;
  cooldownAllowed?: boolean;
  llmResponse?: LlmResponse;
  /** Reply of the tool-free chit-chat pass; an Error makes that pass throw. */
  chitChatResponse?: LlmResponse | Error;
  pendingImageActionService?: PendingImageActionService;
  ocrService?: OcrService;
  mediaStorageService?: MediaStorageService;
  shortTermMemoryService?: ShortTermMemoryService;
  enablePlaceCheck?: boolean;
  existingPlaces?: string[];
}

function createTextInputService(options?: SetupOptions) {
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];

  const mockZaloService = {
    sendMessage: (chatId: string | number, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
    sendTyping: () => Promise.resolve(true),
    startTyping: () => () => {},
    withTyping: <T>(_chatId: string | number, fn: () => Promise<T>) => fn(),
  } as unknown as ZcaMessengerService;

  const _mockUsersService = {
    isAllowed: () => (options?.isAllowed !== undefined ? options.isAllowed : true),
    checkCooldown: () => ({
      allowed: options?.cooldownAllowed !== undefined ? options.cooldownAllowed : true,
      reason: 'Vui lòng gửi chậm lại.',
    }),
    upsertUser: () => Promise.resolve({} as never),
  } as unknown as UsersService;

  const _mockConfigService = {
    get: (key: string) => {
      if (key === 'zalo.allowedUserIds') return options?.allowedUserIds || [];
      return undefined;
    },
  } as unknown as ConfigService;

  const mockFinanceService = {
    resolveContacts: () => Promise.resolve([]),
    createDebt: (dto: {
      counterparty: string;
      amount: number;
      direction: string;
      occurredAt?: string;
      dueAt?: string;
    }) =>
      Promise.resolve({
        id: 'debt_1',
        counterparty: dto.counterparty,
        amount: dto.amount,
        direction: dto.direction,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      } as never),
    createTransaction: (dto: {
      type: string;
      amount: number;
      category: string;
      note: string;
      occurredAt?: string;
    }) =>
      Promise.resolve({
        id: 'tx_1',
        type: dto.type,
        amount: dto.amount,
        category: dto.category,
        note: dto.note,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      } as never),
    getSummary: () =>
      Promise.resolve({
        income: 5000000,
        expense: 2000000,
        balance: 3000000,
      } as never),
    resolvePlaces: (name: string) => {
      if (options?.existingPlaces) {
        const norm = name.trim().toLowerCase();
        const found = options.existingPlaces.filter((p: string) => p.trim().toLowerCase() === norm);
        return Promise.resolve(
          found.map((n: string) => ({ id: 'pl_1', name: n, normalizedName: n })),
        );
      }
      return Promise.resolve([]);
    },
    resolveOrCreatePlace: (name: string) =>
      Promise.resolve({ id: 'pl_1', name, normalizedName: name }),
  } as unknown as FinanceService;

  const _mockRemindersService = {
    createReminder: (dto: { title: string; remindAt: Date }) =>
      Promise.resolve({
        id: 'rem_1',
        title: dto.title,
        remindAt: dto.remindAt,
      } as never),
  } as unknown as RemindersService;

  let llmCallCount = 0;
  let lastLlmPrompt = '';
  let lastLlmInstruction = '';
  let lastLlmToolNames: string[] = [];
  // Tool-free calls are the chit-chat pass; tracked apart so the counters above keep measuring
  // the tool-calling pass only.
  const chitChatCalls: Array<{ prompt: string; systemInstruction: string }> = [];
  const mockLlmService = {
    generate: (prompt: string, tools?: Array<{ name: string }>, systemInstruction?: string) => {
      if (!tools) {
        chitChatCalls.push({ prompt, systemInstruction: systemInstruction || '' });
        const chitChat = options?.chitChatResponse;
        if (chitChat instanceof Error) {
          return Promise.reject(chitChat);
        }
        return Promise.resolve(chitChat ?? options?.llmResponse ?? { text: '' });
      }
      llmCallCount++;
      lastLlmPrompt = prompt;
      lastLlmToolNames = (tools ?? []).map((t) => t.name);
      lastLlmInstruction = systemInstruction || '';
      return Promise.resolve(
        options?.llmResponse || {
          text: 'Xin chào, tôi có thể giúp gì cho bạn?',
        },
      );
    },
  } as unknown as LlmService;

  const welcomeStrategy = new WelcomeToolStrategy(mockZaloService);
  const helpStrategy = new HelpToolStrategy(mockZaloService);
  const echoStrategy = new EchoToolStrategy(mockZaloService);
  const pingStrategy = new PingToolStrategy(mockZaloService);
  const resetStrategy = new ResetToolStrategy(mockZaloService);
  const conversationStrategy = new ConversationToolStrategy(mockZaloService);
  const confirmationService = new TransactionConfirmationService(
    mockZaloService,
    mockFinanceService,
  );
  const manageDebtStrategy = new ManageDebtToolStrategy(
    mockZaloService,
    confirmationService,
    mockFinanceService,
  );
  const recordTransactionStrategy = new RecordTransactionToolStrategy(
    mockZaloService,
    confirmationService,
    options?.enablePlaceCheck ? mockFinanceService : undefined,
  );
  const setReminderStrategy = new SetReminderToolStrategy(mockZaloService, confirmationService);
  const getReportStrategy = new GetReportToolStrategy(mockZaloService, mockFinanceService);
  const createPlaceStrategy = new CreatePlaceToolStrategy(
    mockZaloService,
    confirmationService,
    mockFinanceService,
  );

  const factory = new TextToolFactory(
    welcomeStrategy,
    helpStrategy,
    echoStrategy,
    pingStrategy,
    resetStrategy,
    conversationStrategy,
    manageDebtStrategy,
    recordTransactionStrategy,
    setReminderStrategy,
    getReportStrategy,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    createPlaceStrategy,
  );

  const service = new TextInputService(
    factory,
    mockLlmService,
    mockZaloService,
    confirmationService,
    undefined,
    options?.pendingImageActionService,
    options?.ocrService,
    options?.mediaStorageService,
    undefined,
    options?.shortTermMemoryService,
  );

  return {
    service,
    sentMessages,
    factory,
    confirmationService,
    getLlmCallCount: () => llmCallCount,
    getLastLlmPrompt: () => lastLlmPrompt,
    getLastLlmInstruction: () => lastLlmInstruction,
    getLastLlmToolNames: () => lastLlmToolNames,
    chitChatCalls,
  };
}

void test('TextInputService routes commands to tool strategies without calling LLM', async () => {
  const { service, sentMessages, getLlmCallCount, factory } = createTextInputService();

  // 1. /gioithieu
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '/gioithieu',
  });
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /^👋 Chào Đạt, /);
  assert.equal(getLlmCallCount(), 0);

  // 2. /help
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '/help',
  });
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /Danh sách lệnh hỗ trợ/);
  assert.equal(getLlmCallCount(), 0);

  // 3. /help with @Bot at start
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '@Bot /help',
  });
  assert.equal(sentMessages.length, 3);
  assert.match(sentMessages[2].text, /Danh sách lệnh hỗ trợ/);
  assert.equal(getLlmCallCount(), 0);

  // 4. /help with @Bot at end
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '/help @Bot',
  });
  assert.equal(sentMessages.length, 4);
  assert.match(sentMessages[3].text, /Danh sách lệnh hỗ trợ/);
  assert.equal(getLlmCallCount(), 0);

  // 5. /dashboard with @Bot and extra text
  let dashboardExecuted = false;
  factory.registerStrategy({
    type: TextToolType.DASHBOARD,
    execute: () => {
      dashboardExecuted = true;
      return Promise.resolve();
    },
  });
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '/dashboard @Bot Teétajjsne',
  });
  assert.equal(dashboardExecuted, true);
  assert.equal(getLlmCallCount(), 0);
});

void test('TextInputService routes natural text to LLM and executes MANAGE_DEBT tool', async () => {
  const { service, sentMessages, getLlmCallCount } = createTextInputService({
    llmResponse: {
      toolCall: {
        name: TextToolType.MANAGE_DEBT,
        args: {
          direction: 'payable',
          counterparty: 'a',
          amount: 100000,
        },
      },
    },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'nợ a 100k',
  });

  assert.equal(getLlmCallCount(), 1);
  assert.match(sentMessages[0].text, /^Ghi công nợ \[\d{3}\]\?/);
  assert.match(sentMessages[0].text, /Người liên quan: a/);
  assert.match(sentMessages[0].text, /100\.000 đ/);
  assert.match(sentMessages[0].text, /yes\s+\d{3}/);

  const match = sentMessages[0].text.match(/yes\s+(\d{3})/);
  const code = match ? match[1] : '';

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: `yes ${code}`,
  });

  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /^✅ \[\d{3}\] Bạn nợ a 100\.000đ$/);
});

void test('TextInputService cleans @Bot at beginning and end for natural text before sending to LLM', async () => {
  const { service, getLastLlmPrompt, getLlmCallCount } = createTextInputService({
    llmResponse: {
      text: 'Chào bạn, tôi là bot!',
    },
  });

  // 1. @Bot ở đầu câu
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '@Bot ăn trưa 45k',
  });
  assert.equal(getLastLlmPrompt(), 'ăn trưa 45k');
  assert.equal(getLlmCallCount(), 1);

  // 2. @Bot ở cuối câu
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'chi tiêu 50k đổ xăng @Bot',
  });
  assert.equal(getLastLlmPrompt(), 'chi tiêu 50k đổ xăng');
  assert.equal(getLlmCallCount(), 2);
});

void test('TextInputService routes natural text to LLM and executes RECORD_TRANSACTION tool', async () => {
  const { service, sentMessages } = createTextInputService({
    llmResponse: {
      toolCall: {
        name: TextToolType.RECORD_TRANSACTION,
        args: {
          type: 'expense',
          amount: 45000,
          category: 'Ăn uống',
          note: 'ăn phở',
        },
      },
    },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'ăn phở 45k',
  });

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /khoản chi/);
  assert.match(sentMessages[0].text, /45\.000 đ/);
  assert.match(sentMessages[0].text, /Ăn uống/);
});

void test('TextInputService replies with conversational text when LLM does not call tool', async () => {
  const { service, sentMessages } = createTextInputService({
    llmResponse: {
      text: 'Chào bạn! Hôm nay tôi có thể giúp gì?',
    },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'chào bot',
  });

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].text, 'Chào bạn! Hôm nay tôi có thể giúp gì?');
});

void test('TextInputService handles nested toolCall arguments and parses RECORD_TRANSACTION successfully', async () => {
  const { service, sentMessages } = createTextInputService({
    llmResponse: {
      toolCall: {
        name: TextToolType.RECORD_TRANSACTION,
        args: {
          amount: { amount: 15000 },
          category: { category: 'Ăn uống' },
          note: { note: 'uống cà phê' },
          type: { type: 'expense' },
          occurredAt: '2026-10-11T20:00:00+07:00',
        },
      },
    },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'tối 11/10 tức hôm qua uống cà phê hết 15k',
  });

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /khoản chi/);
  assert.match(sentMessages[0].text, /15\.000 đ/);
  assert.match(sentMessages[0].text, /Ăn uống/);
  assert.match(sentMessages[0].text, /uống cà phê/);
  assert.match(sentMessages[0].text, /11\/10\/2026/);
});

void test('TextInputService handles string amounts like 15k in RECORD_TRANSACTION', async () => {
  const { service, sentMessages } = createTextInputService({
    llmResponse: {
      toolCall: {
        name: TextToolType.RECORD_TRANSACTION,
        args: {
          amount: '15k',
          category: 'Cà phê',
          note: 'cà phê',
          type: 'expense',
        },
      },
    },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'uống cà phê 15k',
  });

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /15\.000 đ/);
});

void test('TextInputService handles pending image action option 1: OCR -> LLM RECORD_TRANSACTION -> Confirmation Card -> User confirms with yes', async () => {
  const pendingImageService = new PendingImageActionService();
  await pendingImageService.setPending('u1', {
    userId: 'u1',
    chatId: 'c1',
    receiptUrl: '/api/receipts/bill-123',
  });

  const mockOcrService = {
    extractTextFromBuffer: () => Promise.resolve('HIGHLANDS COFFEE\nTong cong: 85,000 VND'),
  } as unknown as OcrService;

  const { service, sentMessages } = createTextInputService({
    pendingImageActionService: pendingImageService,
    ocrService: mockOcrService,
    llmResponse: {
      toolCall: {
        name: TextToolType.RECORD_TRANSACTION,
        args: {
          type: 'expense',
          amount: 85000,
          category: 'Ăn uống',
          note: 'Highlands Coffee',
          placeName: 'Highlands Coffee',
          receiptUrl: '/api/receipts/bill-123',
        },
      },
    },
  });

  // User sends "1 Ăn trưa Highlands"
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '1 Ăn trưa Highlands',
  });

  // 1st message: Scanning status
  assert.ok(sentMessages.some((m) => m.text.includes('Đang đọc hoá đơn')));

  // 2nd message: Confirmation card
  const confirmCard = sentMessages.find((m) => m.text.startsWith('Lưu khoản chi ['));
  assert.ok(confirmCard, 'Must send confirmation card to user');
  assert.match(confirmCard.text, /85\.000 đ/);
  assert.match(confirmCard.text, /Highlands Coffee/);
  assert.match(confirmCard.text, /bill-123/);

  // Pending image should be cleared
  const pendingAfter = await pendingImageService.getPending('u1');
  assert.strictEqual(pendingAfter, undefined);

  // User confirms with "yes"
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'yes',
  });

  // 3rd message: Transaction saved successfully
  const savedMsg = sentMessages[sentMessages.length - 1];
  assert.match(savedMsg.text, /^✅ \[\d{3}\] Thu 85\.000đ|^✅ \[\d{3}\] Chi 85\.000đ/);
  assert.match(savedMsg.text, /Highlands Coffee/);
});

void test('TextInputService handles pending image action option 2: Google Drive message', async () => {
  const pendingImageService = new PendingImageActionService();
  await pendingImageService.setPending('u1', {
    userId: 'u1',
    chatId: 'c1',
    receiptUrl: '/api/receipts/bill-456',
  });

  const { service, sentMessages } = createTextInputService({
    pendingImageActionService: pendingImageService,
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '2',
  });

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Google Drive đang được phát triển/);

  const pendingAfter = await pendingImageService.getPending('u1');
  assert.strictEqual(pendingAfter, undefined);
});

void test('TextInputService handles pending image action cancel command', async () => {
  const pendingImageService = new PendingImageActionService();
  await pendingImageService.setPending('u1', {
    userId: 'u1',
    chatId: 'c1',
    receiptUrl: '/api/receipts/bill-789',
  });

  const { service, sentMessages } = createTextInputService({
    pendingImageActionService: pendingImageService,
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'hủy',
  });

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Đã huỷ, bỏ qua ảnh vừa gửi/);

  const pendingAfter = await pendingImageService.getPending('u1');
  assert.strictEqual(pendingAfter, undefined);
});

void test('TextInputService allows user to continue normally when image is pending and normal text is sent', async () => {
  const pendingImageService = new PendingImageActionService();
  await pendingImageService.setPending('u1', {
    userId: 'u1',
    chatId: 'c1',
    receiptUrl: '/api/receipts/bill-abc',
  });

  const { service, sentMessages } = createTextInputService({
    pendingImageActionService: pendingImageService,
    llmResponse: {
      text: 'Chào Đạt, mình có thể giúp gì cho bạn?',
    },
  });

  // User sends normal text instead of 1, 2, or cancel -> does NOT block user!
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'ê',
  });

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Chào Đạt/);

  // Pending image is cleared so user continues freely
  const pendingAfter = await pendingImageService.getPending('u1');
  assert.strictEqual(pendingAfter, undefined);
});

void test('TextInputService handles pending image action cancel with huỷ and mention', async () => {
  const pendingImageService = new PendingImageActionService();
  await pendingImageService.setPending('u1', {
    userId: 'u1',
    chatId: 'c1',
    receiptUrl: '/api/receipts/bill-abc',
  });

  const { service, sentMessages } = createTextInputService({
    pendingImageActionService: pendingImageService,
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'huỷ @Bot Finance Assistant',
  });

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Đã huỷ, bỏ qua ảnh vừa gửi/);

  const pendingAfter = await pendingImageService.getPending('u1');
  assert.strictEqual(pendingAfter, undefined);
});

void test('TextInputService handles "edit <mã> <nội dung>" by feeding context back to LLM and updating confirmation card', async () => {
  const { service, sentMessages, confirmationService, getLastLlmPrompt } = createTextInputService({
    llmResponse: {
      toolCall: {
        name: 'RECORD_TRANSACTION',
        args: {
          type: 'expense',
          amount: 60000,
          category: 'Ăn uống',
          note: 'ăn bún bò',
        },
      },
    },
  });

  // 1. Create initial pending action
  const initialPending = await confirmationService.createPending({
    userId: 'u1',
    chatId: 'c1',
    rawPrompt: 'ăn trưa 45k',
    payload: {
      type: 'expense',
      amount: 45000,
      category: 'Ăn uống',
      note: 'ăn trưa',
    },
  });

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /45\.000 đ/);

  // 2. User sends edit command with code and instruction
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: `edit ${initialPending.code} đổi thành ăn bún bò 60k`,
  });

  // Verify LLM prompt contains previous context
  const llmPrompt = getLastLlmPrompt();
  assert.match(llmPrompt, /RECORD_TRANSACTION/);
  assert.match(llmPrompt, /ăn trưa 45k/);
  assert.match(llmPrompt, /đổi thành ăn bún bò 60k/);

  // A new confirmation card was generated with 60.000 đ
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /60\.000 đ/);
  assert.match(sentMessages[1].text, /ăn bún bò/);

  confirmationService.clearAll();
});

void test('TextInputService handles compound request with 2 expenses and 2 new places, sending exactly 4 confirmation messages (2 places + 2 expenses)', async () => {
  const { service, sentMessages, confirmationService } = createTextInputService({
    enablePlaceCheck: true,
    existingPlaces: [], // Neither place exists
    llmResponse: {
      toolCalls: [
        {
          name: TextToolType.RECORD_TRANSACTION,
          args: {
            type: 'expense',
            amount: 80000,
            category: 'Ăn uống',
            note: 'ăn tối',
            placeName: 'Bến Thành',
          },
        },
        {
          name: TextToolType.RECORD_TRANSACTION,
          args: {
            type: 'expense',
            amount: 90000,
            category: 'Ăn uống',
            note: 'uống nước',
            placeName: 'Aeon',
          },
        },
      ],
    },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'tối nay đi ăn tối hết 80k ở bến thành m sau đó đi uống nước 90k ở aeon',
  });

  // Exactly 4 confirmation messages sent: 2 places + 2 transactions
  assert.equal(sentMessages.length, 4);

  // Message 1: Nơi chốn Bến Thành
  assert.match(sentMessages[0].text, /^Tạo nơi chốn \[\d{3}\]\?/);
  assert.match(sentMessages[0].text, /Bến Thành/);

  // Message 2: Khoản chi ăn tối 80k
  assert.match(sentMessages[1].text, /^Lưu khoản chi \[\d{3}\]\?/);
  assert.match(sentMessages[1].text, /80\.000 đ/);
  assert.match(sentMessages[1].text, /ăn tối/);

  // Message 3: Nơi chốn Aeon
  assert.match(sentMessages[2].text, /^Tạo nơi chốn \[\d{3}\]\?/);
  assert.match(sentMessages[2].text, /Aeon/);

  // Message 4: Khoản chi uống nước 90k
  assert.match(sentMessages[3].text, /^Lưu khoản chi \[\d{3}\]\?/);
  assert.match(sentMessages[3].text, /90\.000 đ/);
  assert.match(sentMessages[3].text, /uống nước/);

  // User confirms all with "yes all"
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'yes all',
  });

  assert.equal(sentMessages.length, 5);
  assert.match(sentMessages[4].text, /^✅ Đã duyệt 4\/4 yêu cầu$/);

  const pendingRemaining = await confirmationService.getPendingListForUser('u1');
  assert.equal(pendingRemaining.length, 0);

  confirmationService.clearAll();
});

void test('TextInputService deduces (giản lược) place confirmations when places already exist in DB, sending minimum 2 confirmation messages', async () => {
  const { service, sentMessages, confirmationService } = createTextInputService({
    enablePlaceCheck: true,
    existingPlaces: ['bến thành', 'aeon'], // Both places already exist!
    llmResponse: {
      toolCalls: [
        {
          name: TextToolType.RECORD_TRANSACTION,
          args: {
            type: 'expense',
            amount: 80000,
            category: 'Ăn uống',
            note: 'ăn tối',
            placeName: 'Bến Thành',
          },
        },
        {
          name: TextToolType.RECORD_TRANSACTION,
          args: {
            type: 'expense',
            amount: 90000,
            category: 'Ăn uống',
            note: 'uống nước',
            placeName: 'Aeon',
          },
        },
      ],
    },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'tối nay đi ăn tối hết 80k ở bến thành m sau đó đi uống nước 90k ở aeon',
  });

  // Places already exist -> simplified/deduced (giản lược) -> exactly 2 transaction cards sent!
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[0].text, /80\.000 đ/);
  assert.match(sentMessages[1].text, /90\.000 đ/);

  confirmationService.clearAll();
});

void test('TextInputService sends 3 confirmation messages when 1 place exists and 1 is new', async () => {
  const { service, sentMessages, confirmationService } = createTextInputService({
    enablePlaceCheck: true,
    existingPlaces: ['bến thành'], // Bến Thành exists, Aeon is new
    llmResponse: {
      toolCalls: [
        {
          name: TextToolType.RECORD_TRANSACTION,
          args: {
            type: 'expense',
            amount: 80000,
            category: 'Ăn uống',
            note: 'ăn tối',
            placeName: 'Bến Thành',
          },
        },
        {
          name: TextToolType.RECORD_TRANSACTION,
          args: {
            type: 'expense',
            amount: 90000,
            category: 'Ăn uống',
            note: 'uống nước',
            placeName: 'Aeon',
          },
        },
      ],
    },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'tối nay đi ăn tối hết 80k ở bến thành m sau đó đi uống nước 90k ở aeon',
  });

  // Exactly 3 confirmation messages sent: 1 place (Aeon) + 2 transactions (80k, 90k)
  assert.equal(sentMessages.length, 3);
  assert.match(sentMessages[0].text, /80\.000 đ/); // Bến Thành tx (no place card for Bến Thành)
  assert.match(sentMessages[1].text, /^Tạo nơi chốn \[\d{3}\]\?/); // Aeon place card
  assert.match(sentMessages[1].text, /Aeon/);
  assert.match(sentMessages[2].text, /90\.000 đ/); // Aeon tx

  confirmationService.clearAll();
});

void test('TextInputService cancels all pending actions when user sends "cancel all"', async () => {
  const { service, sentMessages, confirmationService } = createTextInputService({
    enablePlaceCheck: true,
    existingPlaces: [],
    llmResponse: {
      toolCalls: [
        {
          name: TextToolType.RECORD_TRANSACTION,
          args: {
            type: 'expense',
            amount: 80000,
            category: 'Ăn uống',
            note: 'ăn tối',
            placeName: 'Bến Thành',
          },
        },
      ],
    },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'ăn tối 80k ở Bến Thành',
  });

  assert.equal(sentMessages.length, 2); // 1 place + 1 tx

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'cancel all',
  });

  assert.equal(sentMessages.length, 3);
  assert.equal(sentMessages[2].text, 'Đã huỷ 2 yêu cầu');

  const pendingRemaining = await confirmationService.getPendingListForUser('u1');
  assert.equal(pendingRemaining.length, 0);

  confirmationService.clearAll();
});

void test('TextInputService remains silent when allowAiChat=false and LLM returns conversational response', async () => {
  const { service, sentMessages } = createTextInputService({
    llmResponse: {
      text: 'Tôi là trợ lý AI thông minh!',
    },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'User',
    text: 'Bạn là ai?',
    allowAiChat: false,
  });

  assert.equal(sentMessages.length, 0, 'Bot must remain silent when allowAiChat is false');
});

void test('TextInputService answers general questions via a tool-free chit-chat pass when allowAiChat=true', async () => {
  const { service, sentMessages, chitChatCalls, getLlmCallCount } = createTextInputService({
    llmResponse: { text: 'Em chỉ là trợ lý tài chính nên chưa biết về phim.' },
    chitChatResponse: { text: 'Gần đây có vài phim đáng xem ngoài rạp...' },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'g1',
    displayName: 'User',
    text: 'có phim gì hay chiếu rạp không',
    allowAiChat: true,
  });

  assert.equal(getLlmCallCount(), 1);
  assert.equal(chitChatCalls.length, 1, 'Must run one tool-free chit-chat pass');
  assert.equal(chitChatCalls[0].prompt, 'có phim gì hay chiếu rạp không');
  assert.match(chitChatCalls[0].systemInstruction, /TRÒ CHUYỆN TỰ DO/);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].text, 'Gần đây có vài phim đáng xem ngoài rạp...');
});

void test('TextInputService falls back to the first-pass reply when the chit-chat pass fails or is empty', async () => {
  for (const chitChatResponse of [new Error('provider down'), { text: '   ' }]) {
    const { service, sentMessages, chitChatCalls } = createTextInputService({
      llmResponse: { text: 'Chào bạn!' },
      chitChatResponse,
    });

    await service.process({
      type: 'text',
      senderId: 'u1',
      chatId: 'c1',
      displayName: 'User',
      text: 'xin chào',
    });

    assert.equal(chitChatCalls.length, 1);
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].text, 'Chào bạn!');
  }
});

void test('TextInputService adds the chit-chat block to the tool prompt only when allowAiChat is not false', async () => {
  for (const allowAiChat of [true, undefined]) {
    const { service, getLastLlmInstruction } = createTextInputService();
    await service.process({
      type: 'text',
      senderId: 'u1',
      chatId: 'c1',
      displayName: 'User',
      text: 'kể chuyện cười đi',
      allowAiChat,
    });
    assert.match(getLastLlmInstruction(), /TRÒ CHUYỆN TỰ DO/);
  }

  const { service, getLastLlmInstruction, chitChatCalls } = createTextInputService();
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'User',
    text: 'kể chuyện cười đi',
    allowAiChat: false,
  });
  assert.doesNotMatch(getLastLlmInstruction(), /TRÒ CHUYỆN TỰ DO/);
  assert.equal(chitChatCalls.length, 0, 'No chit-chat pass when allowAiChat is false');
});

void test('TextInputService skips the chit-chat pass when the LLM resolves a tool call', async () => {
  const { service, chitChatCalls } = createTextInputService({
    llmResponse: {
      toolCall: {
        name: TextToolType.RECORD_TRANSACTION,
        args: { type: 'expense', amount: 45000, category: 'Ăn uống', note: 'ăn phở' },
      },
    },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'User',
    text: 'ăn phở 45k',
    allowAiChat: true,
  });

  assert.equal(chitChatCalls.length, 0);
});

void test('TextInputService includes shared context inheritance rules in systemInstruction for LLM tool calling', async () => {
  const { service, getLastLlmInstruction } = createTextInputService({
    llmResponse: {
      text: 'Chào bạn',
    },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'User',
    text: 'hôm nay mua cà phê 13k và mua nước cam 20k ở đối diện ctgroup',
  });

  const instruction = getLastLlmInstruction();
  assert.match(instruction, /placeName/);
  assert.match(instruction, /paymentMethod/);
  assert.match(instruction, /KẾ THỪA NGỮ CẢNH DÙNG CHUNG/);
});

void test('TextInputService includes detailed Vietnam datetime context and weekday in systemInstruction', async () => {
  const { service, getLastLlmInstruction } = createTextInputService({
    llmResponse: {
      text: 'Hôm nay là Thứ Hai',
    },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'User',
    text: 'hôm nay ngày bao nhieu',
  });

  const instruction = getLastLlmInstruction();
  assert.match(instruction, /THỜI GIAN VÀ NGÀY THÁNG THỰC TẾ/);
  assert.match(instruction, /Hôm nay là: (Thứ Hai|Thứ Ba|Thứ Tư|Thứ Năm|Thứ Sáu|Thứ Bảy|Chủ Nhật)/);
  assert.match(instruction, /Múi giờ Asia\/Ho_Chi_Minh/);
  assert.match(instruction, /TUYỆT ĐỐI KHÔNG tự tính nhầm sang thứ khác/);
});

void test('TextInputService propagates shared placeName to all sibling transactions when compound request has single location', async () => {
  const { service, sentMessages, confirmationService } = createTextInputService({
    enablePlaceCheck: true,
    existingPlaces: [],
    llmResponse: {
      toolCalls: [
        {
          name: TextToolType.RECORD_TRANSACTION,
          args: {
            type: 'expense',
            amount: 13000,
            category: 'Ăn uống',
            note: 'mua cà phê',
            occurredAt: '2026-10-15T08:30:00+07:00',
            // Missing placeName from LLM
          },
        },
        {
          name: TextToolType.RECORD_TRANSACTION,
          args: {
            type: 'expense',
            amount: 20000,
            category: 'Ăn uống',
            note: 'mua nước cam',
            occurredAt: '2026-10-15T08:30:00+07:00',
            placeName: 'đối diện ctgroup',
          },
        },
      ],
    },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'hôm nay mua cà phê 13k và mua nước cam 20k ở đối diện ctgroup',
  });

  // Exactly 3 confirmation messages: 1 place card + 2 transaction cards
  assert.equal(sentMessages.length, 3);

  // Message 0: Place card for 'đối diện ctgroup'
  assert.match(sentMessages[0].text, /^Tạo nơi chốn \[\d{3}\]\?/);
  assert.match(sentMessages[0].text, /đối diện ctgroup/);

  // Message 1: First transaction card (13k) MUST have location 'đối diện ctgroup'
  assert.match(sentMessages[1].text, /13\.000 đ/);
  assert.match(sentMessages[1].text, /mua cà phê/);
  assert.match(sentMessages[1].text, /đối diện ctgroup/);

  // Message 2: Second transaction card (20k) MUST have location 'đối diện ctgroup'
  assert.match(sentMessages[2].text, /20\.000 đ/);
  assert.match(sentMessages[2].text, /mua nước cam/);
  assert.match(sentMessages[2].text, /đối diện ctgroup/);

  // Check stored pending transactions
  const pendingList = await confirmationService.getPendingListForUser('u1');
  const txPendings = pendingList.filter((p) => p.actionType === 'RECORD_TRANSACTION');
  assert.equal(txPendings.length, 2);
  assert.equal((txPendings[0].payload as { placeName?: string }).placeName, 'đối diện ctgroup');
  assert.equal((txPendings[1].payload as { placeName?: string }).placeName, 'đối diện ctgroup');

  confirmationService.clearAll();
});

void test('TextInputService does NOT propagate placeName across different timestamps or distinct places', async () => {
  const { service, sentMessages, confirmationService } = createTextInputService({
    enablePlaceCheck: true,
    existingPlaces: ['quán cô tư'],
    llmResponse: {
      toolCalls: [
        {
          name: TextToolType.RECORD_TRANSACTION,
          args: {
            type: 'expense',
            amount: 40000,
            category: 'Ăn uống',
            note: 'ăn sáng',
            occurredAt: '2026-10-15T08:00:00+07:00',
            placeName: 'quán cô Tư',
          },
        },
        {
          name: TextToolType.RECORD_TRANSACTION,
          args: {
            type: 'expense',
            amount: 150000,
            category: 'Ăn uống',
            note: 'ăn tối',
            occurredAt: '2026-10-15T19:00:00+07:00',
            // No placeName
          },
        },
      ],
    },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'sáng ăn phở 40k ở quán cô Tư, tối ăn lẩu 150k',
  });

  // Exactly 2 transactions
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[0].text, /quán cô Tư/);
  // Transaction 2 has no place, so the card has no place line (and never quán cô Tư)
  assert.doesNotMatch(sentMessages[1].text, /Địa điểm|quán cô Tư/);

  confirmationService.clearAll();
});

void test('TextInputService passes full tool definitions in direct mode', async () => {
  const { service, getLastLlmToolNames } = createTextInputService();

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'User',
    text: 'link drive ở đâu',
  });

  assert.ok(getLastLlmToolNames().includes(TextToolType.GET_STORAGE_LINKS));
  assert.ok(getLastLlmToolNames().length > 4);
});

void test('TextInputService edit only exposes the pending action tool and ignores other tools', async () => {
  const { service, sentMessages, confirmationService, getLastLlmToolNames } =
    createTextInputService({
      llmResponse: {
        toolCall: { name: TextToolType.GET_REPORT, args: {} },
      },
    });

  const pending = await confirmationService.createPending({
    userId: 'u1',
    chatId: 'g1',
    rawPrompt: 'ăn trưa 45k',
    payload: { type: 'expense', amount: 45000, category: 'Ăn uống', note: 'ăn trưa' },
  });
  assert.equal(sentMessages.length, 1);

  await service.handleEditPendingAction(
    { type: 'text', senderId: 'u2', chatId: 'g1', displayName: 'Khách', text: '' },
    pending,
    'cho link drive',
  );

  assert.deepEqual(getLastLlmToolNames(), [TextToolType.RECORD_TRANSACTION]);
  assert.equal(sentMessages.length, 1, 'Tool other than the pending action type must not run');

  confirmationService.clearAll();
});

void test('TextInputService edit refuses pending actions without a matching tool', async () => {
  const { service, sentMessages, confirmationService, getLlmCallCount } = createTextInputService();

  const pending = await confirmationService.createPending({
    userId: 'u1',
    chatId: 'g1',
    payload: { type: 'expense', amount: 45000, category: 'Ăn uống', note: 'ăn trưa' },
  });
  const callsBefore = getLlmCallCount();

  await service.handleEditPendingAction(
    { type: 'text', senderId: 'u1', chatId: 'g1', displayName: 'Đạt', text: '' },
    { ...pending, actionType: 'create' },
    'đổi thành 50k',
  );

  assert.equal(getLlmCallCount(), callsBefore);
  assert.equal(
    sentMessages[sentMessages.length - 1].text,
    `⚠️ Yêu cầu [${pending.code}] không sửa được. Gõ "cancel ${pending.code}" rồi tạo yêu cầu mới.`,
  );

  confirmationService.clearAll();
});

void test('TextInputService offers the history search tool only to threads with long-term memory', async () => {
  const { service, getLastLlmToolNames } = createTextInputService({ llmResponse: { text: 'ok' } });
  const base = { type: 'text' as const, senderId: 'u1', chatId: 'c1', displayName: 'Đạt' };

  await service.process({ ...base, text: 'hôm trước mình nói gì' });
  assert.ok(!getLastLlmToolNames().includes('SEARCH_CHAT_HISTORY'));

  await service.process({
    ...base,
    text: 'hôm trước mình nói gì',
    shortTermMemory: { contextWindow: 10, days: 1 },
  });
  assert.ok(!getLastLlmToolNames().includes('SEARCH_CHAT_HISTORY'));

  await service.process({
    ...base,
    text: 'hôm trước mình nói gì',
    longTermMemory: { searchLimit: 15 },
  });
  assert.ok(getLastLlmToolNames().includes('SEARCH_CHAT_HISTORY'));
});

void test('TextInputService adds the short-term memory to the prompt without the long-term memory', async () => {
  const shortTermMemoryService = new ShortTermMemoryService();
  const now = Date.now();
  await shortTermMemoryService.record(
    'c1',
    { msgId: 'm1', content: 'ăn trưa 45k', ts: now - 60_000, dName: 'Nam' },
    1,
  );
  await shortTermMemoryService.record(
    'c1',
    { msgId: 'm2', content: 'ghi giúp cái đó', ts: now },
    1,
  );
  const { service, getLastLlmInstruction } = createTextInputService({
    llmResponse: { text: 'ok' },
    shortTermMemoryService,
  });
  const base = { type: 'text' as const, senderId: 'u1', chatId: 'c1', displayName: 'Đạt' };

  await service.process({ ...base, text: 'ghi giúp cái đó', messageId: 'm2' });
  assert.doesNotMatch(getLastLlmInstruction(), /NGỮ CẢNH GẦN ĐÂY/);

  await service.process({
    ...base,
    text: 'ghi giúp cái đó',
    messageId: 'm2',
    shortTermMemory: { contextWindow: 10, days: 1 },
  });
  assert.match(getLastLlmInstruction(), /NGỮ CẢNH GẦN ĐÂY/);
  assert.match(getLastLlmInstruction(), /Nam: ăn trưa 45k/);
  // The message being processed is not repeated as context.
  assert.doesNotMatch(getLastLlmInstruction(), /: ghi giúp cái đó/);
});

void test('TextInputService reports a failed provider chain once, without the chit-chat pass', async () => {
  const { service, sentMessages, chitChatCalls } = createTextInputService({
    llmResponse: { text: 'Có lỗi khi kết nối tới mô hình AI.', failed: true },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'chào bot',
  });

  assert.equal(chitChatCalls.length, 0);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].text, 'Có lỗi khi kết nối tới mô hình AI.');
});
