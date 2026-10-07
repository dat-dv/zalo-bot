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

  const service = new ZaloService(mockConfigService as any, {} as any, {} as any, {} as any);
  await service.onModuleInit();
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

  const service = new ZaloService(mockConfigService as any, {} as any, {} as any, {} as any);

  service.sendMessage = async (chatId: string | number, text: string) => {
    sentMessages.push({ chatId, text });
    return true;
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

void test('ZaloService handles incoming conversational message with Gemini AI', async () => {
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];
  const history: string[] = [];

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
    upsertUser: async () => ({}),
  };

  const mockGeminiService = {
    chat: async (text: string) => ({ text: `Gemini: ${text}` }),
  };

  const mockConversationHistoryService = {
    getHistory: () => [],
    appendUserMessage: (_id: string, text: string) => history.push(`user: ${text}`),
    appendModelMessage: (_id: string, text: string) => history.push(`model: ${text}`),
  };

  const service = new ZaloService(
    mockConfigService as any,
    mockUsersService as any,
    mockGeminiService as any,
    mockConversationHistoryService as any,
  );

  service.sendMessage = async (chatId: string | number, text: string) => {
    sentMessages.push({ chatId, text });
    return true;
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
  assert.equal(sentMessages[0].text, 'Gemini: Cơm trưa 35k');
  assert.deepEqual(history, ['user: Cơm trưa 35k', 'model: Gemini: Cơm trưa 35k']);
});

void test('ZaloService handles /reset and clears history', async () => {
  let clearedUserId = '';
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];

  const mockConfigService = {
    get: (key: string) => {
      if (key === 'zalo.botToken') return 'mock_token';
      return undefined;
    },
  };

  const mockConversationHistoryService = {
    clearHistory: (id: string) => {
      clearedUserId = id;
    },
  };

  const service = new ZaloService(
    mockConfigService as any,
    {} as any,
    {} as any,
    mockConversationHistoryService as any,
  );

  service.sendMessage = async (chatId: string | number, text: string) => {
    sentMessages.push({ chatId, text });
    return true;
  };

  await service.processInput({
    sender: { id: 'user_reset' },
    message: {
      text: '/reset',
    },
  });

  assert.equal(clearedUserId, 'user_reset');
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Đã làm mới ngữ cảnh/);
});
