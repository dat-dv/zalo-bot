import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChannelFolder,
  getChannelDriveFolderPath,
  isValidEmail,
} from './channel-storage.util';

void test('buildChannelFolder cleans and uses channelId strictly', () => {
  assert.equal(buildChannelFolder('g-12345'), 'g-12345');
  assert.equal(buildChannelFolder('789123456789'), '789123456789');
  assert.equal(buildChannelFolder('  g-abc_123  '), 'g-abc_123');
});

void test('getChannelDriveFolderPath returns correct subfolder paths using only channelId', () => {
  assert.equal(getChannelDriveFolderPath('g-123', 'bill'), 'zalobot/g-123/bill');
  assert.equal(getChannelDriveFolderPath('g-123', 'image'), 'zalobot/g-123/image');
  assert.equal(getChannelDriveFolderPath('g-123', 'video'), 'zalobot/g-123/video');
  assert.equal(getChannelDriveFolderPath('g-123', 'file'), 'zalobot/g-123/file');
  assert.equal(getChannelDriveFolderPath('g-123', 'audio'), 'zalobot/g-123/audio');
  assert.equal(getChannelDriveFolderPath('g-123'), 'zalobot/g-123');
});

void test('isValidEmail validates email format correctly', () => {
  assert.equal(isValidEmail('test@gmail.com'), true);
  assert.equal(isValidEmail('user.name+tag@example.com.vn'), true);
  assert.equal(isValidEmail('invalid-email'), false);
  assert.equal(isValidEmail(''), false);
});
