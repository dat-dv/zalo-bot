import assert from 'node:assert/strict';
import test from 'node:test';
import { CHAT_MEMORY_DEFAULTS, CHAT_MEMORY_LIMITS, type ThreadBotConfig } from '@zalobot/contracts';
import {
  configToForm,
  formToPayload,
  memoryDraftFrom,
  resolveChatMemory,
} from './thread-config-form';

function makeConfig(overrides: Partial<ThreadBotConfig> = {}): ThreadBotConfig {
  return {
    threadId: 't1',
    isListened: true,
    directInteraction: { enabled: true, triggerPrefixes: ['bot:'] },
    mediaBackup: { enabled: false, uploadImages: true, uploadVideos: false },
    confirmationRules: { allowReactions: true, requiredHearts: 3, timeoutMinutes: 10 },
    chatMemory: { enabled: true, contextWindow: 8, searchLimit: 12 },
    ...overrides,
  };
}

test('configToForm fills optional fields with explicit defaults', () => {
  const form = configToForm(makeConfig(), 'group');

  assert.deepEqual(form.directInteraction, {
    enabled: true,
    triggerPrefixes: ['bot:'],
    allowAiChat: false,
    allowSelf: false,
  });
  assert.equal(form.mediaBackup.uploadImages, true);
  assert.equal(form.mediaBackup.uploadFiles, false);
  assert.equal(form.mediaBackup.customFolder, '');
  assert.equal(form.mediaBackup.photosAlbum, '');
});

test('configToForm defaults required hearts by thread kind when rules are missing', () => {
  // Older rows reach the web without confirmation rules even though the type requires them.
  const missingRules = Object.assign(makeConfig(), { confirmationRules: undefined });

  assert.equal(configToForm(missingRules, 'group').confirmationRules.requiredHearts, 5);
  assert.equal(configToForm(missingRules, 'user').confirmationRules.requiredHearts, 1);
});

test('resolveChatMemory falls back to defaults for empty fields and clamps typed numbers', () => {
  const form = configToForm(makeConfig(), 'group');

  assert.deepEqual(resolveChatMemory(form, { contextWindow: '  ', searchLimit: '' }), {
    enabled: true,
    contextWindow: CHAT_MEMORY_DEFAULTS.contextWindow,
    searchLimit: CHAT_MEMORY_DEFAULTS.searchLimit,
  });
  assert.equal(
    resolveChatMemory(form, { contextWindow: '999', searchLimit: '5' }).contextWindow,
    CHAT_MEMORY_LIMITS.CONTEXT_WINDOW_MAX,
  );
});

test('formToPayload sends identity, every section and the resolved chat memory', () => {
  const form = configToForm(makeConfig({ driveFolderUrl: 'https://drive.google.com/x' }), 'group');
  const payload = formToPayload(form, memoryDraftFrom(form.chatMemory), 'Nhóm A', 'group');

  assert.equal(payload.threadName, 'Nhóm A');
  assert.equal(payload.threadType, 'group');
  assert.equal(payload.isListened, true);
  assert.equal(payload.driveFolderUrl, 'https://drive.google.com/x');
  assert.deepEqual(payload.confirmationRules, form.confirmationRules);
  assert.deepEqual(payload.chatMemory, { enabled: true, contextWindow: 8, searchLimit: 12 });
});
