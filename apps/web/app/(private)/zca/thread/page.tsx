import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ThreadConfigScreen } from '@/modules/zca/view/thread-config-screen';

export const metadata: Metadata = {
  title: 'Cấu hình cuộc trò chuyện | Zalo Bot Assistant',
  description: 'Cấu hình tính năng bot cho một nhóm hoặc cuộc trò chuyện Zalo',
};

export default function ZcaThreadPage() {
  return (
    <Suspense>
      <ThreadConfigScreen />
    </Suspense>
  );
}
