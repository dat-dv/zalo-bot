import assert from 'node:assert/strict';
import test from 'node:test';
import { ManageDebtToolStrategy } from './manage-debt-tool.strategy';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { CreateDebtDto, FinanceService } from '../../../finance/finance.service';
import { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';
import { DebtContactEntity } from '../../../database/entities/debt-contact.entity';
import { AgentInput } from '../../../types/agent-input.type';

interface TestContext {
  strategy: ManageDebtToolStrategy;
  sentMessages: string[];
  pendingPayloads: CreateDebtDto[];
  resolveCalls: Array<{ name: string; alias?: string }>;
}

function contact(id: string, displayName: string, alias?: string): DebtContactEntity {
  return { id, displayName, alias } as DebtContactEntity;
}

function createTestContext(matches: DebtContactEntity[]): TestContext {
  const sentMessages: string[] = [];
  const pendingPayloads: CreateDebtDto[] = [];
  const resolveCalls: Array<{ name: string; alias?: string }> = [];

  const mockZaloService = {
    sendMessage: (_chatId: string | number, text: string) => {
      sentMessages.push(text);
      return Promise.resolve(true);
    },
  } as unknown as ZcaMessengerService;

  const mockFinanceService = {
    resolveContacts: (name: string, alias?: string) => {
      resolveCalls.push({ name, alias });
      return Promise.resolve(matches);
    },
  } as unknown as FinanceService;

  const mockConfirmationService = {
    createPendingDebt: (params: { payload: CreateDebtDto }) => {
      pendingPayloads.push(params.payload);
      return Promise.resolve({ code: '123' } as never);
    },
  } as unknown as TransactionConfirmationService;

  const strategy = new ManageDebtToolStrategy(
    mockZaloService,
    mockConfirmationService,
    mockFinanceService,
  );
  return { strategy, sentMessages, pendingPayloads, resolveCalls };
}

function run(strategy: ManageDebtToolStrategy, toolArgs: Record<string, unknown>): Promise<void> {
  return strategy.execute({
    input: { type: 'text', text: 'nợ Trí 100k' } as AgentInput,
    chatId: 'c1',
    senderId: 'u1',
    displayName: 'Đạt',
    text: 'nợ Trí 100k',
    toolArgs,
  });
}

void test('MANAGE_DEBT binds the single matching contact to the pending payload', async () => {
  const { strategy, pendingPayloads } = createTestContext([contact('ct-1', 'Trí', 'Trí Đen')]);

  await run(strategy, { direction: 'payable', counterparty: 'trí', amount: 100000 });

  assert.equal(pendingPayloads.length, 1);
  assert.equal(pendingPayloads[0].contactId, 'ct-1');
  assert.equal(pendingPayloads[0].createNewContact, undefined);
  assert.equal(pendingPayloads[0].counterparty, 'Trí');
  assert.equal(pendingPayloads[0].counterpartyAlias, 'Trí Đen');
});

void test('MANAGE_DEBT asks to create a new contact when nobody matches', async () => {
  const { strategy, pendingPayloads } = createTestContext([]);

  await run(strategy, { direction: 'receivable', counterparty: 'Nam', amount: 200000 });

  assert.equal(pendingPayloads.length, 1);
  assert.equal(pendingPayloads[0].contactId, undefined);
  assert.equal(pendingPayloads[0].createNewContact, true);
  assert.equal(pendingPayloads[0].counterparty, 'Nam');
});

void test('MANAGE_DEBT stops and asks for an alias when several contacts share the name', async () => {
  const { strategy, pendingPayloads, sentMessages } = createTestContext([
    contact('ct-1', 'Trí', 'Trí Đen'),
    contact('ct-2', 'Trí', 'Trí Trắng'),
  ]);

  await run(strategy, { direction: 'payable', counterparty: 'Trí', amount: 100000 });

  assert.equal(pendingPayloads.length, 0);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /Trí \(Trí Đen\)/);
  assert.match(sentMessages[0], /Trí \(Trí Trắng\)/);
});

void test('MANAGE_DEBT passes the alias from tool args to the contact lookup', async () => {
  const { strategy, resolveCalls } = createTestContext([contact('ct-1', 'Trí', 'Trí Đen')]);

  await run(strategy, {
    direction: 'payable',
    counterparty: 'Trí',
    counterpartyAlias: 'Trí Đen',
    amount: 100000,
  });

  assert.deepEqual(resolveCalls, [{ name: 'Trí', alias: 'Trí Đen' }]);
});
