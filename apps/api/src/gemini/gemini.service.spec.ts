import assert from 'node:assert/strict';
import test from 'node:test';
import { GeminiService } from './gemini.service';
import { ConfigService } from '@nestjs/config';
import { getCurrentTimeInfo, buildSystemInstruction } from './helpers/gemini-prompt.helper';

void test('getCurrentTimeInfo formats time with timezone', () => {
  const timeInfo = getCurrentTimeInfo('Asia/Ho_Chi_Minh');
  assert.ok(timeInfo.nowText.includes('Asia/Ho_Chi_Minh'));
  assert.ok(timeInfo.nowIso.length > 0);
});

void test('buildSystemInstruction includes time context', () => {
  const instruction = buildSystemInstruction('Asia/Ho_Chi_Minh');
  assert.ok(instruction.includes('Zalo'));
  assert.ok(instruction.includes('Asia/Ho_Chi_Minh'));
});

void test('GeminiService returns notice when GEMINI_API_KEY is not configured', async () => {
  const configService = new ConfigService({
    gemini: { apiKey: '', model: 'gemini-2.5-flash' },
    timezone: 'Asia/Ho_Chi_Minh',
  });
  const service = new GeminiService(configService);
  const result = await service.chat('Xin chào');
  assert.match(result.text, /GEMINI_API_KEY/);
});
