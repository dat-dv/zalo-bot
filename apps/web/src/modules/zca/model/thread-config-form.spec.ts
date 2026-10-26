import assert from 'node:assert/strict';
import test from 'node:test';
import type { ThreadBotConfig } from '@zalobot/contracts';
import { configToForm, formToPayload } from './thread-config-form';

function makeConfig(overrides: Partial<ThreadBotConfig> = {}): ThreadBotConfig {
  return {
    threadId: 't1',
    isListened: true,
    directInteraction: { enabled: true, triggerPrefixes: ['bot:'] },
    mediaBackup: { enabled: false, uploadImages: true, uploadVideos: false },
    confirmationRules: { allowReactions: true, requiredHearts: 3, timeoutMinutes: 10 },
    chatMemory: { enabled: true, readImageText: false, learnPeople: true },
    memberAccess: { mode: 'selected-members', memberIds: ['u1'] },
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

test('formToPayload sends identity, every section and the clean chat memory', () => {
  const form = configToForm(makeConfig({ driveFolderUrl: 'https://drive.google.com/x' }), 'group');
  const payload = formToPayload(form, 'Nhóm A', 'group');

  assert.equal(payload.threadName, 'Nhóm A');
  assert.equal(payload.threadType, 'group');
  assert.equal(payload.isListened, true);
  assert.equal(payload.driveFolderUrl, 'https://drive.google.com/x');
  assert.deepEqual(payload.confirmationRules, form.confirmationRules);
  assert.deepEqual(payload.chatMemory, { enabled: true, readImageText: false, learnPeople: true });
});

test('configToForm and formToPayload keep a clean member access config', () => {
  // Rows cached before member access existed reach the web without it.
  const legacy = Object.assign(makeConfig(), { memberAccess: undefined });
  assert.deepEqual(configToForm(legacy, 'group').memberAccess, {
    mode: 'granted-users',
    memberIds: [],
  });

  const form = configToForm(
    makeConfig({ memberAccess: { mode: 'selected-members', memberIds: ['u1', 'u1', ' u2 '] } }),
    'group',
  );
  const payload = formToPayload(form, 'Nhóm', 'group');
  assert.deepEqual(payload.memberAccess, { mode: 'selected-members', memberIds: ['u1', 'u2'] });
});
