import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { ZaloService } from './zalo.service';
import { ZALO_EVENTS } from './zalo.constants';

void test('ZaloService verifies signature correctly with configured secret', () => {
  const secretKey = 'test-secret-key';
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'zalo.oaSecretKey') return secretKey;
      if (key === 'zalo.appId') return '123456';
      return undefined;
    },
  };

  const service = new ZaloService(
    mockConfigService as any,
    {} as any,
    {} as any,
    {} as any,
  );

  const rawBody = JSON.stringify({ event_name: 'user_send_text', sender: { id: 'user_1' } });
  const validHmac = createHmac('sha256', secretKey).update(rawBody).digest('hex');

  // Valid signature
  assert.equal(service.verifySignature(`mac=${validHmac}`, rawBody), true);
  // Invalid signature
  assert.equal(service.verifySignature('mac=invalid_sig', rawBody), false);
  // Missing signature
  assert.equal(service.verifySignature(undefined, rawBody), false);
});

void test('ZaloService allows all requests when no secret key is configured in dev mode', () => {
  const mockConfigService = {
    get: () => undefined,
  };

  const service = new ZaloService(
    mockConfigService as any,
    {} as any,
    {} as any,
    {} as any,
  );

  assert.equal(service.verifySignature(undefined, '{}'), true);
});

void test('ZaloService processes user_send_text event and invokes Gemini', async () => {
  const sentMessages: Array<{ recipientId: string; text: string }> = [];
  const mockConfigService = {
    get: (key: string) => {
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
    chat: async (text: string) => ({ text: `AI trả lời: ${text}` }),
  };

  const history: string[] = [];
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

  // Stub sendMessage to capture outputs without network call
  service.sendMessage = async (recipientId: string, text: string) => {
    sentMessages.push({ recipientId, text });
    return true;
  };

  const result = await service.handleWebhookEvent({
    event_name: ZALO_EVENTS.USER_SEND_TEXT,
    sender: { id: 'zalo_user_123' },
    recipient: { id: 'oa_456' },
    message: { text: 'Chào trợ lý!' },
    timestamp: Date.now(),
  });

  assert.equal(result.error, 0);
  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].recipientId, 'zalo_user_123');
  assert.equal(sentMessages[0].text, 'AI trả lời: Chào trợ lý!');
  assert.deepEqual(history, ['user: Chào trợ lý!', 'model: AI trả lời: Chào trợ lý!']);
});
