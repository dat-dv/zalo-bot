import assert from 'node:assert/strict';
import test from 'node:test';
import { TextToolFactory } from './text-tool.factory';
import { TextToolType } from './text-tool.enum';
import { StartToolStrategy } from './strategies/start-tool.strategy';
import { HelpToolStrategy } from './strategies/help-tool.strategy';
import { EchoToolStrategy } from './strategies/echo-tool.strategy';
import { PingToolStrategy } from './strategies/ping-tool.strategy';
import { ResetToolStrategy } from './strategies/reset-tool.strategy';
import { ConversationToolStrategy } from './strategies/conversation-tool.strategy';
import { ZaloService } from '../zalo.service';
import { UsersService } from '../../users/users.service';
import { ConfigService } from '@nestjs/config';

function createFactory(): TextToolFactory {
  const mockZaloService = { sendMessage: () => Promise.resolve(true) } as unknown as ZaloService;
  const mockUsersService = {
    isAllowed: () => true,
    checkCooldown: () => ({ allowed: true }),
    upsertUser: () => Promise.resolve({} as never),
  } as unknown as UsersService;
  const mockConfigService = { get: () => undefined } as unknown as ConfigService;

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

  return new TextToolFactory(
    startStrategy,
    helpStrategy,
    echoStrategy,
    pingStrategy,
    resetStrategy,
    conversationStrategy,
  );
}

void test('TextToolFactory resolves tool types by enum correctly', () => {
  const factory = createFactory();

  assert.equal(factory.resolveToolType('/start'), TextToolType.START);
  assert.equal(factory.resolveToolType('/help'), TextToolType.HELP);
  assert.equal(factory.resolveToolType('/echo test'), TextToolType.ECHO);
  assert.equal(factory.resolveToolType('/ping'), TextToolType.PING);
  assert.equal(factory.resolveToolType('/reset'), TextToolType.RESET);
  assert.equal(factory.resolveToolType('/clear'), TextToolType.RESET);
  assert.equal(factory.resolveToolType('ăn sáng 45k'), TextToolType.CONVERSATION);
});

void test('TextToolFactory returns corresponding strategy for each enum type', () => {
  const factory = createFactory();

  assert.equal(factory.getStrategy(TextToolType.START).type, TextToolType.START);
  assert.equal(factory.getStrategy(TextToolType.HELP).type, TextToolType.HELP);
  assert.equal(factory.getStrategy(TextToolType.ECHO).type, TextToolType.ECHO);
  assert.equal(factory.getStrategy(TextToolType.PING).type, TextToolType.PING);
  assert.equal(factory.getStrategy(TextToolType.RESET).type, TextToolType.RESET);
  assert.equal(factory.getStrategy(TextToolType.CONVERSATION).type, TextToolType.CONVERSATION);
});
