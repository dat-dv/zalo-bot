'use client';

import { useState } from 'react';
import type {
  ChannelStorageLinkKind,
  ThreadBotConfig,
  ThreadMediaBackupConfig,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { getThreadDriveFolderLabel, getThreadPhotosAlbumLabel } from '../../../api/zca-api';
import { ThreadStorageLinksDialog } from '../thread-storage-links-dialog';
import { MediaStorageFields } from './media-storage-fields';
import { ConfigSectionCard } from './config-section-card';
import { ConfigToggleRow } from './config-toggle-row';
import { MediaTypeCheckboxes } from './media-type-checkboxes';
import { StorageLinkBanner } from './storage-link-banner';

interface MediaBackupSectionProps {
  form: ThreadBotConfig;
  threadId: string;
  threadName: string;
  onChange: (form: ThreadBotConfig) => void;
}

export function MediaBackupSection({
  form,
  threadId,
  threadName,
  onChange,
}: MediaBackupSectionProps) {
  const { t } = useLocale();
  const [linksKind, setLinksKind] = useState<ChannelStorageLinkKind | null>(null);
  const media = form.mediaBackup;
  const setMedia = (patch: Partial<ThreadMediaBackupConfig>) =>
    onChange({ ...form, mediaBackup: { ...media, ...patch } });

  return (
    <ConfigSectionCard
      description="Tự động bắt hình ảnh, video gửi vào nhóm và đẩy lên Google Drive"
      enabled={media.enabled}
      icon="📁"
      onEnabledChange={(enabled) => setMedia({ enabled })}
      title="Tự động lưu trữ tài nguyên (Google Drive)"
    >
      <StorageLinkBanner
        buttonLabel="Mở Google Drive"
        buttonTitle={t('zca.storageLinks.openDrive')}
        description="Tất cả hình ảnh, video, tệp tin từ cuộc trò chuyện này sẽ được lưu tại đây"
        icon="📁"
        kind="drive"
        label="Thư mục Drive:"
        onOpen={() => setLinksKind('drive')}
        value={getThreadDriveFolderLabel({ id: threadId }, form)}
      />
      <StorageLinkBanner
        buttonLabel="Mở Google Photos"
        buttonTitle={t('zca.storageLinks.openPhotos')}
        description="Tự động tạo album riêng trên Google Photos cho cuộc trò chuyện này"
        icon="📸"
        kind="photos"
        label="Album Google Photos:"
        onOpen={() => setLinksKind('photos')}
        value={getThreadPhotosAlbumLabel({ id: threadId, name: threadName }, form)}
      />
      <MediaTypeCheckboxes media={media} onChange={setMedia} />
      <ConfigToggleRow
        checked={media.notifyInThread ?? false}
        className="border-t border-slate-100 pt-3 dark:border-slate-800"
        description="Mặc định tắt để tránh làm loãng hoặc spam cuộc trò chuyện trong nhóm."
        onChange={(notifyInThread) => setMedia({ notifyInThread })}
        size="md"
        title="Gửi tin nhắn thông báo vào nhóm sau khi lưu"
      />
      <MediaStorageFields media={media} onChange={setMedia} threadLabel={threadName || threadId} />
      {linksKind && (
        <ThreadStorageLinksDialog
          kind={linksKind}
          onClose={() => setLinksKind(null)}
          threadId={threadId}
          threadName={threadName}
        />
      )}
    </ConfigSectionCard>
  );
}
