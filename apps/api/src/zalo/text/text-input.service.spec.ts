import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { TextInputService } from './text-input.service';
import { TextToolFactory } from './text-tool.factory';
import { TextToolType } from './text-tool.enum';
import { StartToolStrategy } from './strategies/start-tool.strategy';
import { HelpToolStrategy } from './strategies/help-tool.strategy';
import { EchoToolStrategy } from './strategies/echo-tool.strategy';
import { PingToolStrategy } from './strategies/ping-tool.strategy';
import { ResetToolStrategy } from './strategies/reset-tool.strategy';
import { ConversationToolStrategy } from './strategies/conversation-tool.strategy';
import { ManageDebtToolStrategy } from './strategies/manage-debt-tool.strategy';
import { RecordTransactionToolStrategy } from './strategies/record-transaction-tool.strategy';
import { SetReminderToolStrategy } from './strategies/set-reminder-tool.strategy';
import { GetReportToolStrategy } from './strategies/get-report-tool.strategy';
import { ZaloService } from '../zalo.service';
import { UsersService } from '../../users/users.service';
import { FinanceService } from '../../finance/finance.service';
import { RemindersService } from '../../reminders/reminders.service';
import { LlmService } from '../../llm/llm.service';
import { LlmResponse } from '../../llm/types/llm.types';
import { TransactionConfirmationService } from '../transaction-confirmation.service';
import { CreatePlaceToolStrategy } from './strategies/create-place-tool.strategy';

import { PendingImageActionService } from '../pending-image-action.service';
import { OcrService } from '../../ocr/ocr.service';
import { MediaStorageService } from '../../receipt-storage/media-storage.service';

interface SetupOptions {
  allowedUserIds?: string[];
  isAllowed?: boolean;
  cooldownAllowed?: boolean;
  llmResponse?: LlmResponse;
  pendingImageActionService?: PendingImageActionService;
  ocrService?: OcrService;
  mediaStorageService?: MediaStorageService;
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
    sendChatAction: () => Promise.resolve(true),
    startChatAction: () => () => {},
    withChatAction: <T>(_chatId: string | number, fn: () => Promise<T>) => fn(),
  } as unknown as ZaloService;

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
    resolvePlaces: (_userId: string | number, name: string) => {
      if (options?.existingPlaces) {
        const norm = name.trim().toLowerCase();
        const found = options.existingPlaces.filter((p: string) => p.trim().toLowerCase() === norm);
        return Promise.resolve(
          found.map((n: string) => ({ id: 'pl_1', name: n, normalizedName: n })),
        );
      }
      return Promise.resolve([]);
    },
    resolveOrCreatePlace: (_userId: string | number, name: string) =>
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
  const mockLlmService = {
    generate: (prompt: string) => {
      llmCallCount++;
      lastLlmPrompt = prompt;
      return Promise.resolve(
        options?.llmResponse || {
          text: 'Xin chào, tôi có thể giúp gì cho bạn?',
        },
      );
    },
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
  );

  return {
    service,
    sentMessages,
    factory,
    confirmationService,
    getLlmCallCount: () => llmCallCount,
    getLastLlmPrompt: () => lastLlmPrompt,
  };
}

void test('TextInputService routes commands to tool strategies without calling LLM', async () => {
  const { service, sentMessages, getLlmCallCount, factory } = createTextInputService();

  // 1. /start
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '/start',
  });
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Chào Đạt!/);
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
  assert.match(sentMessages[0].text, /Xác nhận/);
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
  assert.match(sentMessages[1].text, /Đã xác nhận và ghi nhận khoản nợ thành công/);
  assert.match(sentMessages[1].text, /Người liên quan: a/);
  assert.match(sentMessages[1].text, /100\.000 đ/);
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
  assert.ok(sentMessages.some((m) => m.text.includes('Tesseract OCR')));

  // 2nd message: Confirmation card
  const confirmCard = sentMessages.find((m) => m.text.includes('xác nhận'));
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
  assert.match(savedMsg.text, /Đã xác nhận và lưu/);
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
  assert.match(sentMessages[0].text, /Đã hủy yêu cầu xử lý hình ảnh/);

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
  assert.match(sentMessages[0].text, /Đã hủy yêu cầu xử lý hình ảnh/);

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
      userId: 'u1',
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
  assert.match(sentMessages[0].text, /tạo nơi chốn/);
  assert.match(sentMessages[0].text, /Bến Thành/);

  // Message 2: Khoản chi ăn tối 80k
  assert.match(sentMessages[1].text, /Khoản chi/);
  assert.match(sentMessages[1].text, /80\.000 đ/);
  assert.match(sentMessages[1].text, /ăn tối/);

  // Message 3: Nơi chốn Aeon
  assert.match(sentMessages[2].text, /tạo nơi chốn/);
  assert.match(sentMessages[2].text, /Aeon/);

  // Message 4: Khoản chi uống nước 90k
  assert.match(sentMessages[3].text, /Khoản chi/);
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
  assert.match(sentMessages[4].text, /Đã xác nhận thành công tất cả \(4\/4\) yêu cầu/);

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
  assert.match(sentMessages[1].text, /tạo nơi chốn/); // Aeon place card
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
  assert.match(sentMessages[2].text, /Đã hủy tất cả \(2\) yêu cầu/);

  const pendingRemaining = await confirmationService.getPendingListForUser('u1');
  assert.equal(pendingRemaining.length, 0);

  confirmationService.clearAll();
});

void test('TextInputService remains completely silent when passiveOnly=true and no tool was called', async () => {
  const { service, sentMessages } = createTextInputService({
    llmResponse: {
      text: 'Chào bạn! Mình có thể giúp gì cho bạn hôm nay?',
    },
  });

  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'g1',
    displayName: 'Thành viên',
    text: 'hello bot',
    passiveOnly: true,
  });

  assert.equal(sentMessages.length, 0, 'Bot must not send any message in passive mode when no tool called');
});

void test('TextInputService executes tool when passiveOnly=true and LLM calls RECORD_TRANSACTION', async () => {
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
    chatId: 'g1',
    displayName: 'Thành viên',
    text: 'ăn phở 45k',
    passiveOnly: true,
  });

  assert.equal(sentMessages.length, 1, 'Bot must process expense tool in passive mode');
  assert.match(sentMessages[0].text, /45\.000/);
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
