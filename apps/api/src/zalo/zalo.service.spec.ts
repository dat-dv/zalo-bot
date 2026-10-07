import assert from 'node:assert/strict';
import test from 'node:test';
import { ZaloService } from './zalo.service';

void test('ZaloService initializes and logs webhook configuration onModuleInit', async () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'zalo.botToken') return 'mock_token_123';
      if (key === 'zalo.webhookUrl') return 'https://example.com/webhook';
      return undefined;
    },
  };

  const service = new ZaloService(mockConfigService as any, {} as any);
  service.onModuleInit();
  assert.ok(service);
});

void test('ZaloService processUpdate processes /start, /help, /echo, /ping', async () => {
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'zalo.botToken') return 'mock_token_123';
      return undefined;
    },
  };

  const service = new ZaloService(mockConfigService as any, {} as any);

  service.sendMessage = (chatId: string | number, text: string) => {
    sentMessages.push({ chatId, text });
    return Promise.resolve(true);
  };

  // 1. /start
  await service.processInput({
    message: {
      chat: { id: 'c1' },
      from: { id: 'u1', display_name: 'Đạt' },
      text: '/start',
    },
  });
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Chào Đạt!/);

  // 2. /help
  await service.processInput({
    message: {
      chat: { id: 'c1' },
      from: { id: 'u1' },
      text: '/help',
    },
  });
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /Danh sách lệnh hỗ trợ/);

  // 3. /echo with text
  await service.processInput({
    message: {
      chat: { id: 'c1' },
      from: { id: 'u1' },
      text: '/echo Xin chào',
    },
  });
  assert.equal(sentMessages.length, 3);
  assert.equal(sentMessages[2].text, 'Bạn vừa nói: Xin chào');

  // 4. /echo without text
  await service.processInput({
    message: {
      chat: { id: 'c1' },
      from: { id: 'u1' },
      text: '/echo',
    },
  });
  assert.equal(sentMessages.length, 4);
  assert.match(sentMessages[3].text, /Hãy nhập gì đó sau lệnh \/echo/);

  // 5. /ping
  await service.processInput({
    message: {
      chat: { id: 'c1' },
      from: { id: 'u1' },
      text: '/ping',
    },
  });
  assert.equal(sentMessages.length, 5);
  assert.match(sentMessages[4].text, /Pong!/);
});

void test('ZaloService handles incoming conversational message', async () => {
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];

  const mockConfigService = {
    get: (key: string) => {
      if (key === 'zalo.botToken') return 'mock_token';
      if (key === 'zalo.allowedUserIds') return [];
      return undefined;
    },
  };

  const mockUsersService = {
    isAllowed: () => true,
    checkCooldown: () => ({ allowed: true }),
    upsertUser: () => Promise.resolve({} as any),
  };

  const service = new ZaloService(mockConfigService as any, mockUsersService as any);

  service.sendMessage = (chatId: string | number, text: string) => {
    sentMessages.push({ chatId, text });
    return Promise.resolve(true);
  };

  await service.processInput({
    sender: { id: 'user_123' },
    message: {
      text: 'Cơm trưa 35k',
      from: { id: 'user_123', display_name: 'Dat' },
    },
  });

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].chatId, 'user_123');
  assert.match(sentMessages[0].text, /Cơm trưa 35k/);
});

void test('ZaloService handles /reset and clears session', async () => {
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];

  const mockConfigService = {
    get: (key: string) => {
      if (key === 'zalo.botToken') return 'mock_token';
      return undefined;
    },
  };

  const service = new ZaloService(mockConfigService as any, {} as any);

  service.sendMessage = (chatId: string | number, text: string) => {
    sentMessages.push({ chatId, text });
    return Promise.resolve(true);
  };

  await service.processInput({
    sender: { id: 'user_reset' },
    message: {
      text: '/reset',
    },
  });

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Đã làm mới ngữ cảnh/);
});
