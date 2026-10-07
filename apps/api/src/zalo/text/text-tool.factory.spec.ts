import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
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

function createFactory(): TextToolFactory {
  const mockZaloService = { sendMessage: () => Promise.resolve(true) } as unknown as ZaloService;
  const mockUsersService = {
    isAllowed: () => true,
    checkCooldown: () => ({ allowed: true }),
    upsertUser: () => Promise.resolve({} as never),
  } as unknown as UsersService;
  const mockConfigService = { get: () => undefined } as unknown as ConfigService;
  const mockFinanceService = {
    createDebt: () => Promise.resolve({} as never),
    createTransaction: () => Promise.resolve({} as never),
    getSummary: () => Promise.resolve({ income: 0, expense: 0, balance: 0 } as never),
  } as unknown as FinanceService;
  const mockRemindersService = {
    createReminder: () => Promise.resolve({ remindAt: new Date() } as never),
  } as unknown as RemindersService;

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

  return new TextToolFactory(
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
}

void test('TextToolFactory resolves tool types by enum correctly', () => {
  const factory = createFactory();

  assert.equal(factory.resolveFastPathToolType('/start'), TextToolType.START);
  assert.equal(factory.resolveFastPathToolType('/help'), TextToolType.HELP);
  assert.equal(factory.resolveFastPathToolType('/echo test'), TextToolType.ECHO);
  assert.equal(factory.resolveFastPathToolType('/ping'), TextToolType.PING);
  assert.equal(factory.resolveFastPathToolType('/reset'), TextToolType.RESET);
  assert.equal(factory.resolveFastPathToolType('/clear'), TextToolType.RESET);
  assert.equal(factory.resolveFastPathToolType('nợ a 100k'), null);
});

void test('TextToolFactory returns corresponding strategy for each enum type', () => {
  const factory = createFactory();

  assert.equal(factory.getStrategy(TextToolType.START).type, TextToolType.START);
  assert.equal(factory.getStrategy(TextToolType.HELP).type, TextToolType.HELP);
  assert.equal(factory.getStrategy(TextToolType.ECHO).type, TextToolType.ECHO);
  assert.equal(factory.getStrategy(TextToolType.PING).type, TextToolType.PING);
  assert.equal(factory.getStrategy(TextToolType.RESET).type, TextToolType.RESET);
  assert.equal(factory.getStrategy(TextToolType.CONVERSATION).type, TextToolType.CONVERSATION);
  assert.equal(factory.getStrategy(TextToolType.MANAGE_DEBT).type, TextToolType.MANAGE_DEBT);
  assert.equal(
    factory.getStrategy(TextToolType.RECORD_TRANSACTION).type,
    TextToolType.RECORD_TRANSACTION,
  );
  assert.equal(factory.getStrategy(TextToolType.SET_REMINDER).type, TextToolType.SET_REMINDER);
  assert.equal(factory.getStrategy(TextToolType.GET_REPORT).type, TextToolType.GET_REPORT);
});
