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

interface SetupOptions {
  allowedUserIds?: string[];
  isAllowed?: boolean;
  cooldownAllowed?: boolean;
  llmResponse?: LlmResponse;
}

function createTextInputService(options?: SetupOptions) {
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];

  const mockZaloService = {
    sendMessage: (chatId: string | number, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
  } as unknown as ZaloService;

  const mockUsersService = {
    isAllowed: () => (options?.isAllowed !== undefined ? options.isAllowed : true),
    checkCooldown: () => ({
      allowed: options?.cooldownAllowed !== undefined ? options.cooldownAllowed : true,
      reason: 'Vui lòng gửi chậm lại.',
    }),
    upsertUser: () => Promise.resolve({} as never),
  } as unknown as UsersService;

  const mockConfigService = {
    get: (key: string) => {
      if (key === 'zalo.allowedUserIds') return options?.allowedUserIds || [];
      return undefined;
    },
  } as unknown as ConfigService;

  const mockFinanceService = {
    createDebt: (dto: { counterparty: string; amount: number; direction: string }) =>
      Promise.resolve({
        id: 'debt_1',
        counterparty: dto.counterparty,
        amount: dto.amount,
        direction: dto.direction,
      } as never),
    createTransaction: (dto: { type: string; amount: number; category: string; note: string }) =>
      Promise.resolve({
        id: 'tx_1',
        type: dto.type,
        amount: dto.amount,
        category: dto.category,
        note: dto.note,
      } as never),
    getSummary: () =>
      Promise.resolve({
        income: 5000000,
        expense: 2000000,
        balance: 3000000,
      } as never),
  } as unknown as FinanceService;

  const mockRemindersService = {
    createReminder: (dto: { title: string; remindAt: Date }) =>
      Promise.resolve({
        id: 'rem_1',
        title: dto.title,
        remindAt: dto.remindAt,
      } as never),
  } as unknown as RemindersService;

  let llmCallCount = 0;
  const mockLlmService = {
    generate: () => {
      llmCallCount++;
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
  const conversationStrategy = new ConversationToolStrategy(
    mockZaloService,
    mockUsersService,
    mockConfigService,
  );
  const manageDebtStrategy = new ManageDebtToolStrategy(mockZaloService, mockFinanceService);
  const recordTransactionStrategy = new RecordTransactionToolStrategy(
    mockZaloService,
    mockFinanceService,
  );
  const setReminderStrategy = new SetReminderToolStrategy(mockZaloService, mockRemindersService);
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

  const service = new TextInputService(factory, mockLlmService);

  return { service, sentMessages, factory, getLlmCallCount: () => llmCallCount };
}

void test('TextInputService routes commands to tool strategies without calling LLM', async () => {
  const { service, sentMessages, getLlmCallCount } = createTextInputService();

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
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Đã ghi nhận khoản nợ thành công/);
  assert.match(sentMessages[0].text, /Người liên quan: a/);
  assert.match(sentMessages[0].text, /100\.000 đ/);
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
