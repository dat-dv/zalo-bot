import assert from 'node:assert/strict';
import test from 'node:test';
import { ZaloController } from './zalo.controller';
import { ZaloWebhookPayload } from './dto/zalo-webhook.dto';

void test('ZaloController GET webhook returns challenge verification or status', () => {
  const controller = new ZaloController({} as any);

  const res1 = controller.verifyWebhook('challenge_token_abc');
  assert.equal(res1, 'challenge_token_abc');

  const res2 = controller.verifyWebhook(undefined, 'hub_challenge_xyz');
  assert.equal(res2, 'hub_challenge_xyz');

  const res3 = controller.verifyWebhook() as { status: string };
  assert.equal(res3.status, 'ok');
});

void test('ZaloController POST webhook forwards update to ZaloService', () => {
  let processedPayload: unknown = null;
  const mockZaloService = {
    processUpdate: (payload: unknown) => {
      processedPayload = payload;
    },
  };

  const controller = new ZaloController(mockZaloService as any);

  const payload: ZaloWebhookPayload = {
    update_id: 1,
    message: {
      chat: { id: 'u1' },
      from: { id: 'u1' },
      text: 'Hello',
    },
  };

  const result = controller.handleWebhook(payload);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(processedPayload, payload);
});
