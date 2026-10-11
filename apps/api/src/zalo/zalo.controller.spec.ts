import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { ZaloController } from './zalo.controller';
import { InputProcessor } from './input-processor.service';
import { ZaloMessageParser } from './zalo-message-parser.service';
import { ZaloWebhookPayloadDto } from './dto/zalo-webhook.dto';
import { AgentInput } from './types/agent-input.type';

void test('ZaloController GET webhook returns challenge verification or status', () => {
  const controller = new ZaloController(
    {} as unknown as InputProcessor,
    {} as unknown as ZaloMessageParser,
    {} as unknown as ConfigService,
  );

  const res1 = controller.verifyWebhook('challenge_token_abc');
  assert.equal(res1, 'challenge_token_abc');

  const res2 = controller.verifyWebhook(undefined, 'hub_challenge_xyz');
  assert.equal(res2, 'hub_challenge_xyz');

  const res3 = controller.verifyWebhook() as { status: string };
  assert.equal(res3.status, 'ok');
});

void test('ZaloController POST webhook forwards parsed input to InputProcessor', () => {
  let receivedInput: AgentInput | null = null;
  const mockInputProcessor = {
    process: (input: AgentInput) => {
      receivedInput = input;
      return Promise.resolve();
    },
  };

  const mockConfigService = {
    get: (_key: string): undefined => undefined,
  };

  const parser = new ZaloMessageParser();
  const controller = new ZaloController(
    mockInputProcessor as unknown as InputProcessor,
    parser,
    mockConfigService as unknown as ConfigService,
  );

  const payload: ZaloWebhookPayloadDto = {
    message: {
      message_id: 'm1',
      date: 123456789,
      chat: { id: 'u1' },
      from: { id: 'u1' },
      text: 'Hello',
    },
  };

  const result = controller.handleWebhook(payload);

  assert.deepEqual(result, { ok: true });
  assert.equal(receivedInput?.text, 'Hello');
  assert.equal(receivedInput?.senderId, 'u1');
});

void test('ZaloController POST webhook rejects invalid secret token', () => {
  let processed = false;
  const mockInputProcessor = {
    process: () => {
      processed = true;
      return Promise.resolve();
    },
  };

  const mockConfigService = {
    get: (key: string) => {
      if (key === 'zalo.secretToken') return 'expected_secret';
      return undefined;
    },
  };

  const parser = new ZaloMessageParser();
  const controller = new ZaloController(
    mockInputProcessor as unknown as InputProcessor,
    parser,
    mockConfigService as unknown as ConfigService,
  );

  const payload: ZaloWebhookPayloadDto = {
    message: {
      message_id: 'm1',
      date: 123456789,
      chat: { id: 'u1' },
      from: { id: 'u1' },
      text: 'Hello',
    },
  };

  const result = controller.handleWebhook(payload, 'wrong_token');

  assert.deepEqual(result, { ok: false });
  assert.equal(processed, false);
});
