'use client';

import type { ThreadBotConfig } from '@zalobot/contracts';
import { ConfigSectionCard } from './config-section-card';

interface ImageTextMemorySectionProps {
  form: ThreadBotConfig;
  onChange: (form: ThreadBotConfig) => void;
}

/** What reading photos does, so admins know what ends up in the memory. */
const HOW_IT_WORKS: ReadonlyArray<{ title: string; text: string }> = [
  {
    title: 'Đọc ở đâu',
    text: 'ngay trên server bằng OCR, ảnh không được gửi cho AI.',
  },
  {
    title: 'Ảnh nào',
    text: 'mọi ảnh gửi vào kênh, kể cả ảnh không gọi bot. Bot đọc lần lượt từng ảnh; gửi dồn quá 20 ảnh thì các ảnh dư chỉ được nhớ là [Ảnh].',
  },
  {
    title: 'Nhớ gì',
    text: 'chữ đọc được, đã bỏ ký tự rác, gắn vào đúng tin ảnh. Ảnh không có chữ chỉ nhớ nhãn [Ảnh].',
  },
  {
    title: 'Hạn chế',
    text: 'chữ mờ, nghiêng hoặc viết tay có thể đọc sai. Ảnh gửi trước khi bật không được đọc lại.',
  },
];

/** Text read from the chat's photos joins the long-term memory; acts only while it is on. */
export function ImageTextMemorySection({ form, onChange }: ImageTextMemorySectionProps) {
  const memory = form.chatMemory;

  return (
    <ConfigSectionCard
      description="Đọc chữ trong ảnh gửi vào kênh (menu, lịch, thông báo) để bot nhớ cùng tấm ảnh"
      enabled={memory.readImageText}
      icon="🖼️"
      onEnabledChange={(readImageText) =>
        onChange({ ...form, chatMemory: { ...memory, readImageText } })
      }
      title="Đọc chữ trong ảnh"
    >
      {!memory.enabled && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Chưa có tác dụng: bật Nhớ lâu dài để bot bắt đầu đọc ảnh.
        </p>
      )}
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Chữ trong ảnh được lưu vào trí nhớ lâu dài và có thể được gửi cho AI như tin nhắn chữ. Nên
        tắt nếu nhóm hay gửi ảnh giấy tờ cá nhân (CCCD, sao kê).
      </p>
      <div>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Cách hoạt động</p>
        <ul className="mt-1.5 grid list-disc gap-1.5 pl-4 text-xs text-slate-600 dark:text-slate-300">
          {HOW_IT_WORKS.map((point) => (
            <li key={point.title}>
              <span className="font-medium text-slate-700 dark:text-slate-200">{point.title}:</span>{' '}
              {point.text}
            </li>
          ))}
        </ul>
      </div>
    </ConfigSectionCard>
  );
}
