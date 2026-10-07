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
import { ZaloService } from '../zalo.service';
import { UsersService } from '../../users/users.service';

interface SetupOptions {
  allowedUserIds?: string[];
  isAllowed?: boolean;
  cooldownAllowed?: boolean;
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

  const service = new TextInputService(factory);

  return { service, sentMessages, factory };
}

void test('TextInputService routes commands to tool strategies correctly', async () => {
  const { service, sentMessages } = createTextInputService();

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

  // 3. /echo
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '/echo Hello World',
  });
  assert.equal(sentMessages.length, 3);
  assert.equal(sentMessages[2].text, 'Bạn vừa nói: Hello World');

  // 4. /ping
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '/ping',
  });
  assert.equal(sentMessages.length, 4);
  assert.match(sentMessages[3].text, /Pong!/);

  // 5. /reset
  await service.process({
    type: 'text',
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '/reset',
  });
  assert.equal(sentMessages.length, 5);
  assert.match(sentMessages[4].text, /Đã làm mới ngữ cảnh/);
});

void test('TextInputService allows explicit toolTypeOverride', async () => {
  const { service, sentMessages } = createTextInputService();

  await service.process(
    {
      type: 'text',
      senderId: 'u1',
      chatId: 'c1',
      displayName: 'Đạt',
      text: 'custom text',
    },
    TextToolType.START,
  );

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Chào Đạt!/);
});
