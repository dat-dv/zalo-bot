import assert from 'node:assert/strict';
import test from 'node:test';
import { ZaloController } from './zalo.controller';
import { ZaloWebhookPayload } from './dto/zalo-webhook.dto';

void test('ZaloController GET webhook returns challenge verification', () => {
  const controller = new ZaloController({} as any);

  const res1 = controller.verifyWebhook('challenge_token_abc');
  assert.equal(res1, 'challenge_token_abc');

  const res2 = controller.verifyWebhook(undefined, 'hub_challenge_xyz');
  assert.equal(res2, 'hub_challenge_xyz');

  const res3 = controller.verifyWebhook() as { status: string };
  assert.equal(res3.status, 'ok');
});

void test('ZaloController POST webhook verifies signature and delegates processing', async () => {
  let processedPayload: ZaloWebhookPayload | null = null;
  const mockZaloService = {
    verifySignature: () => true,
    handleWebhookEvent: async (payload: ZaloWebhookPayload) => {
      processedPayload = payload;
      return { error: 0, message: 'Success' };
    },
  };

  const controller = new ZaloController(mockZaloService as any);

  const payload: ZaloWebhookPayload = {
    event_name: 'user_send_text',
    sender: { id: 'u1' },
    recipient: { id: 'oa1' },
    message: { text: 'Hello' },
    timestamp: 123456789,
  };

  const result = await controller.handleWebhook(payload, 'mac=123', '123456789');

  assert.deepEqual(result, { error: 0, message: 'Success' });
  // Verify service received payload
  assert.equal(processedPayload?.sender.id, 'u1');
});
