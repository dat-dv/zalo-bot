'use client';

import type { ThreadMediaBackupConfig } from '@zalobot/contracts';

type MediaTypeKey = 'uploadImages' | 'uploadVideos' | 'uploadFiles' | 'uploadAudios';

const MEDIA_TYPES: ReadonlyArray<{ key: MediaTypeKey; label: string }> = [
  { key: 'uploadImages', label: '📸 Lưu hình ảnh (.jpg, .png)' },
  { key: 'uploadVideos', label: '🎥 Lưu video (.mp4)' },
  { key: 'uploadFiles', label: '📄 Lưu tài liệu & tệp tin (.pdf, .docx, .xlsx, .zip...)' },
  { key: 'uploadAudios', label: '🎙️ Lưu tin nhắn thoại & âm thanh (.mp3, .aac, .m4a...)' },
];

interface MediaTypeCheckboxesProps {
  media: ThreadMediaBackupConfig;
  onChange: (patch: Partial<ThreadMediaBackupConfig>) => void;
}

export function MediaTypeCheckboxes({ media, onChange }: MediaTypeCheckboxesProps) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-slate-600 dark:text-slate-400">
        Loại tài nguyên tự động lưu (Mặc định tắt):
      </legend>
      <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {MEDIA_TYPES.map(({ key, label }) => (
          <label
            className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
            key={key}
          >
            <input
              checked={media[key] ?? false}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              onChange={(e) => onChange({ [key]: e.target.checked })}
              type="checkbox"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
