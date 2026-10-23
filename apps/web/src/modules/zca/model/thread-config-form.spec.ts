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
    chatMemory: {
      enabled: true,
      shortTermEnabled: false,
      contextWindow: 8,
      shortTermDays: 2,
      searchLimit: 12,
      readImageText: false,
    },
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

test('resolveChatMemory falls back to defaults for empty fields and clamps typed numbers', () => {
  const form = configToForm(makeConfig(), 'group');

  assert.deepEqual(
    resolveChatMemory(form, { contextWindow: '  ', shortTermDays: '', searchLimit: '' }),
    {
      enabled: true,
      shortTermEnabled: false,
      contextWindow: CHAT_MEMORY_DEFAULTS.contextWindow,
      shortTermDays: CHAT_MEMORY_DEFAULTS.shortTermDays,
      searchLimit: CHAT_MEMORY_DEFAULTS.searchLimit,
      readImageText: false,
    },
  );
  assert.equal(
    resolveChatMemory(form, { contextWindow: '999', shortTermDays: '2', searchLimit: '5' })
      .contextWindow,
    CHAT_MEMORY_LIMITS.CONTEXT_WINDOW_MAX,
  );
  assert.equal(
    resolveChatMemory(form, { contextWindow: '8', shortTermDays: '30', searchLimit: '5' })
      .shortTermDays,
    CHAT_MEMORY_LIMITS.SHORT_TERM_DAYS_MAX,
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
  assert.deepEqual(payload.chatMemory, {
    enabled: true,
    shortTermEnabled: false,
    contextWindow: 8,
    shortTermDays: 2,
    searchLimit: 12,
    readImageText: false,
  });
});

test('formToPayload keeps the short-term memory on while the long-term memory is off', () => {
  const form = configToForm(
    makeConfig({
      chatMemory: {
        enabled: false,
        shortTermEnabled: true,
        contextWindow: 6,
        shortTermDays: 3,
        searchLimit: 15,
        readImageText: true,
      },
    }),
    'group',
  );
  const payload = formToPayload(form, memoryDraftFrom(form.chatMemory), 'Nhóm A', 'group');

  assert.equal(payload.chatMemory?.enabled, false);
  assert.equal(payload.chatMemory?.shortTermEnabled, true);
  assert.equal(payload.chatMemory?.contextWindow, 6);
  assert.equal(payload.chatMemory?.shortTermDays, 3);
  assert.equal(payload.chatMemory?.readImageText, true);
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
  const payload = formToPayload(form, memoryDraftFrom(form.chatMemory), 'Nhóm', 'group');
  assert.deepEqual(payload.memberAccess, { mode: 'selected-members', memberIds: ['u1', 'u2'] });
});
