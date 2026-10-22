import assert from 'node:assert/strict';
import test from 'node:test';
import { isLegacyZaloBotId } from './legacy-zalo-bot-id';

void test('recognises the 20-hex ids of the removed official Zalo Bot', () => {
  assert.equal(isLegacyZaloBotId('573462d8909179cf2080'), true);
  assert.equal(isLegacyZaloBotId('573462D8909179CF2080'), true);
});

void test('ZCA uids, dashboard-owner and other lengths are not legacy ids', () => {
  assert.equal(isLegacyZaloBotId('2099328425338516056'), false);
  assert.equal(isLegacyZaloBotId('20993284253385160561'), false);
  assert.equal(isLegacyZaloBotId('dashboard-owner'), false);
  assert.equal(isLegacyZaloBotId('573462d8909179cf208'), false);
  assert.equal(isLegacyZaloBotId('573462d8909179cf20800'), false);
  assert.equal(isLegacyZaloBotId(''), false);
});
