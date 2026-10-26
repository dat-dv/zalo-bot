import {
  normalizeChatMemoryConfig,
  normalizeMemberAccessConfig,
  type ThreadBotConfig,
  type UpdateThreadBotConfigDto,
} from '@zalobot/contracts';

export type ThreadKind = 'user' | 'group';

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

export function formToPayload(
  form: ThreadBotConfig,
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
    chatMemory: normalizeChatMemoryConfig(form.chatMemory),
    memberAccess: normalizeMemberAccessConfig(form.memberAccess),
  };
}
