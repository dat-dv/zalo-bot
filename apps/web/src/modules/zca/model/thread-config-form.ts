import {
  CHAT_MEMORY_DEFAULTS,
  normalizeChatMemoryConfig,
  normalizeMemberAccessConfig,
  type ThreadBotConfig,
  type UpdateThreadBotConfigDto,
} from '@zalobot/contracts';

export type ThreadKind = 'user' | 'group';

/**
 * Raw text of the chat-memory number inputs: clamping on every keystroke would rewrite what the
 * user is typing (clearing the field, typing "25"), so values are normalized on blur and save.
 */
export interface ChatMemoryDraft {
  contextWindow: string;
  searchLimit: string;
}

/** Fills every optional field so the form controls are always controlled. */
export function configToForm(config: ThreadBotConfig, threadType: ThreadKind): ThreadBotConfig {
  return {
    ...config,
    isListened: config.isListened ?? false,
    directInteraction: {
      enabled: config.directInteraction?.enabled ?? false,
      triggerPrefixes: config.directInteraction?.triggerPrefixes ?? [],
      allowAiChat: config.directInteraction?.allowAiChat ?? false,
      allowSelf: config.directInteraction?.allowSelf ?? false,
    },
    mediaBackup: {
      enabled: config.mediaBackup?.enabled ?? false,
      uploadImages: config.mediaBackup?.uploadImages ?? false,
      uploadVideos: config.mediaBackup?.uploadVideos ?? false,
      uploadFiles: config.mediaBackup?.uploadFiles ?? false,
      uploadAudios: config.mediaBackup?.uploadAudios ?? false,
      notifyInThread: config.mediaBackup?.notifyInThread ?? false,
      customFolder: config.mediaBackup?.customFolder || '',
      fileSuffix: config.mediaBackup?.fileSuffix || '',
      photosAlbum: config.mediaBackup?.photosAlbum || '',
    },
    confirmationRules: config.confirmationRules || {
      allowReactions: false,
      requiredHearts: threadType === 'group' ? 5 : 1,
      timeoutMinutes: 5,
    },
    chatMemory: normalizeChatMemoryConfig(config.chatMemory),
    memberAccess: normalizeMemberAccessConfig(config.memberAccess),
  };
}

export function memoryDraftFrom(chatMemory: ThreadBotConfig['chatMemory']): ChatMemoryDraft {
  return {
    contextWindow: String(chatMemory.contextWindow),
    searchLimit: String(chatMemory.searchLimit),
  };
}

/**
 * Follow-up window size after its switch flips: off is 0; on restores the size used before it was
 * turned off, or the default when there is none.
 */
export function contextWindowAfterToggle(enabled: boolean, lastSize: number): number {
  if (!enabled) return 0;
  return lastSize > 0 ? lastSize : CHAT_MEMORY_DEFAULTS.contextWindow;
}

/** Applies the typed numbers; an empty field falls back to the default. */
export function resolveChatMemory(
  form: ThreadBotConfig,
  draft: ChatMemoryDraft,
): ThreadBotConfig['chatMemory'] {
  return normalizeChatMemoryConfig({
    ...form.chatMemory,
    contextWindow: draft.contextWindow.trim() || undefined,
    searchLimit: draft.searchLimit.trim() || undefined,
  });
}

export function formToPayload(
  form: ThreadBotConfig,
  draft: ChatMemoryDraft,
  threadName: string,
  threadType: ThreadKind,
): UpdateThreadBotConfigDto {
  return {
    threadName,
    threadType,
    isListened: form.isListened,
    driveFolderId: form.driveFolderId,
    driveFolderUrl: form.driveFolderUrl,
    driveFolderPath: form.driveFolderPath,
    photosAlbumId: form.photosAlbumId,
    photosAlbumUrl: form.photosAlbumUrl,
    photosAlbumTitle: form.photosAlbumTitle,
    directInteraction: form.directInteraction,
    mediaBackup: form.mediaBackup,
    confirmationRules: form.confirmationRules,
    chatMemory: resolveChatMemory(form, draft),
    memberAccess: normalizeMemberAccessConfig(form.memberAccess),
  };
}
