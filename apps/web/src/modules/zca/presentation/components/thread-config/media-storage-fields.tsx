'use client';

import type { ThreadMediaBackupConfig } from '@zalobot/contracts';
import { ConfigField } from './config-field';

interface MediaStorageFieldsProps {
  media: ThreadMediaBackupConfig;
  /** Shown in the album placeholder, falling back to the id for unnamed chats. */
  threadLabel: string;
  onChange: (patch: Partial<ThreadMediaBackupConfig>) => void;
}

/** Optional overrides of where and under which names the chat's media is stored. */
export function MediaStorageFields({ media, threadLabel, onChange }: MediaStorageFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <ConfigField
        hint="Để trống sẽ lưu vào zalobot/image hoặc zalobot/video"
        label="Thư mục Google Drive riêng"
        onChange={(e) => onChange({ customFolder: e.target.value })}
        placeholder="VD: zalobot/Nhom-Ke-Toan"
        value={media.customFolder || ''}
      />
      <ConfigField
        hint="Để trống để tự động tạo album theo tên nhóm"
        label="Tên Album Google Photos riêng"
        onChange={(e) => onChange({ photosAlbum: e.target.value })}
        placeholder={`VD: [Zalo] ${threadLabel}`}
        value={media.photosAlbum || ''}
      />
      <ConfigField
        className="sm:col-span-2"
        hint="Tránh trùng tên file khi có nhiều người/nhóm cùng upload"
        label="Hậu tố tên file (Suffix)"
        onChange={(e) => onChange({ fileSuffix: e.target.value })}
        placeholder="VD: _ketoan hoặc _family"
        value={media.fileSuffix || ''}
      />
    </div>
  );
}
