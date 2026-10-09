import assert from 'node:assert/strict';
import test from 'node:test';
import { TextToolFactory } from './text-tool.factory';
import { TextToolType } from './text-tool.enum';

function createDummyStrategy(type: TextToolType) {
  return { type, execute: () => Promise.resolve() } as unknown as never;
}

function createFactory(): TextToolFactory {
  return new TextToolFactory(
    createDummyStrategy(TextToolType.START),
    createDummyStrategy(TextToolType.HELP),
    createDummyStrategy(TextToolType.ECHO),
    createDummyStrategy(TextToolType.PING),
    createDummyStrategy(TextToolType.RESET),
    createDummyStrategy(TextToolType.CONVERSATION),
    createDummyStrategy(TextToolType.MANAGE_DEBT),
    createDummyStrategy(TextToolType.RECORD_TRANSACTION),
    createDummyStrategy(TextToolType.SET_REMINDER),
    createDummyStrategy(TextToolType.GET_REPORT),
    createDummyStrategy(TextToolType.LOGIN),
    createDummyStrategy(TextToolType.CODE),
    createDummyStrategy(TextToolType.STATUS),
    createDummyStrategy(TextToolType.TODAY),
    createDummyStrategy(TextToolType.WEEK),
    createDummyStrategy(TextToolType.FINANCE),
    createDummyStrategy(TextToolType.DEBTS),
    createDummyStrategy(TextToolType.TASKS),
    createDummyStrategy(TextToolType.REMINDERS),
    createDummyStrategy(TextToolType.DASHBOARD),
    createDummyStrategy(TextToolType.INVITE),
    createDummyStrategy(TextToolType.USERS),
    createDummyStrategy(TextToolType.BAN),
    createDummyStrategy(TextToolType.CREATE_CALENDAR_EVENT),
    createDummyStrategy(TextToolType.LIST_CALENDAR_EVENTS),
    createDummyStrategy(TextToolType.DELETE_CALENDAR_EVENT),
    createDummyStrategy(TextToolType.CREATE_TASK),
    createDummyStrategy(TextToolType.LIST_TASKS),
    createDummyStrategy(TextToolType.COMPLETE_TASK),
    createDummyStrategy(TextToolType.LOGIN_GOOGLE),
    createDummyStrategy(TextToolType.CREATE_INVITE_LINK),
  );
}

void test('TextToolFactory resolves tool types by enum correctly', () => {
  const factory = createFactory();

  assert.equal(factory.resolveFastPathToolType('/start'), TextToolType.START);
  assert.equal(factory.resolveFastPathToolType('/start invite_123'), TextToolType.START);
  assert.equal(factory.resolveFastPathToolType('invite_abc'), TextToolType.START);
  assert.equal(factory.resolveFastPathToolType('/help'), TextToolType.HELP);
  assert.equal(factory.resolveFastPathToolType('/echo test'), TextToolType.ECHO);
  assert.equal(factory.resolveFastPathToolType('/ping'), TextToolType.PING);
  assert.equal(factory.resolveFastPathToolType('/reset'), TextToolType.RESET);
  assert.equal(factory.resolveFastPathToolType('/clear'), TextToolType.RESET);

  assert.equal(factory.resolveFastPathToolType('/login'), TextToolType.LOGIN);
  assert.equal(factory.resolveFastPathToolType('/auth'), TextToolType.LOGIN);
  assert.equal(factory.resolveFastPathToolType('/code 12345'), TextToolType.CODE);
  assert.equal(factory.resolveFastPathToolType('code=12345'), TextToolType.CODE);
  assert.equal(
    factory.resolveFastPathToolType('4/0AQb8C1xZ-LONG-GOOGLE-AUTH-CODE-12345'),
    TextToolType.CODE,
  );
  assert.equal(factory.resolveFastPathToolType('/status'), TextToolType.STATUS);
  assert.equal(factory.resolveFastPathToolType('/today'), TextToolType.TODAY);
  assert.equal(factory.resolveFastPathToolType('/week'), TextToolType.WEEK);
  assert.equal(factory.resolveFastPathToolType('/finance'), TextToolType.FINANCE);
  assert.equal(factory.resolveFastPathToolType('/thuchi'), TextToolType.FINANCE);
  assert.equal(factory.resolveFastPathToolType('/debts'), TextToolType.DEBTS);
  assert.equal(factory.resolveFastPathToolType('/congo'), TextToolType.DEBTS);
  assert.equal(factory.resolveFastPathToolType('/tasks'), TextToolType.TASKS);
  assert.equal(factory.resolveFastPathToolType('/viec'), TextToolType.TASKS);
  assert.equal(factory.resolveFastPathToolType('/task mua sữa'), TextToolType.TASKS);
  assert.equal(factory.resolveFastPathToolType('/reminders'), TextToolType.REMINDERS);
  assert.equal(factory.resolveFastPathToolType('/nhac'), TextToolType.REMINDERS);
  assert.equal(factory.resolveFastPathToolType('/dashboard'), TextToolType.DASHBOARD);
  assert.equal(factory.resolveFastPathToolType('/invite'), TextToolType.INVITE);
  assert.equal(factory.resolveFastPathToolType('/users'), TextToolType.USERS);
  assert.equal(factory.resolveFastPathToolType('/ban u123'), TextToolType.BAN);

  assert.equal(factory.resolveFastPathToolType('nợ a 100k'), null);
});

void test('TextToolFactory returns corresponding strategy for each enum type', () => {
  const factory = createFactory();

  for (const type of Object.values(TextToolType)) {
    const strategy = factory.getStrategy(type);
    assert.ok(strategy, `Strategy should exist for ${type}`);
    assert.equal(strategy.type, type);
  }
});
