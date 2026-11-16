import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptSecret, encryptSecret, parseEncryptionKey } from './secret-cipher';

const KEY = parseEncryptionKey('a'.repeat(64));
const OTHER_KEY = parseEncryptionKey('b'.repeat(64));

void test('secret cipher round-trips and never stores the plain value', () => {
  assert.ok(KEY);
  const stored = encryptSecret('sk-live-123', KEY);
  assert.match(stored ?? '', /^enc:v1:/);
  assert.doesNotMatch(stored ?? '', /sk-live-123/);
  assert.equal(decryptSecret(stored, KEY), 'sk-live-123');
});

void test('secret cipher keeps empty and legacy plain values, rejects another key', () => {
  assert.ok(KEY && OTHER_KEY);
  assert.equal(encryptSecret('', KEY), undefined);
  assert.equal(decryptSecret('plain', KEY), 'plain');
  assert.throws(() => decryptSecret(encryptSecret('x', KEY), OTHER_KEY));
});

void test('parseEncryptionKey accepts only 64 hex characters', () => {
  assert.equal(parseEncryptionKey(undefined), null);
  assert.equal(parseEncryptionKey('zz'), null);
  assert.equal(parseEncryptionKey(` ${'0'.repeat(64)} `)?.length, 32);
});
