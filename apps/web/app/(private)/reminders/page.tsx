import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RemindersScreen } from '@/modules/dashboard/view/reminders-screen';

export const metadata: Metadata = {
  title: 'Nhắc nhở',
  description: 'Danh sách lời nhắc tự động qua tin nhắn Zalo & cuộc gọi báo động.',
};

export default function RemindersPage() {
  return (
    <Suspense>
      <RemindersScreen />
    </Suspense>
  );
}
