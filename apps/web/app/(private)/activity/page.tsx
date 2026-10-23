import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ActivityScreen } from '@/modules/audit/view/activity-screen';

export const metadata: Metadata = {
  title: 'Nhật ký hoạt động | Zalo Bot Assistant',
  description: 'Ai đã thêm, sửa hoặc xoá dữ liệu, lúc nào và từ đâu (chỉ admin).',
};

export default function ActivityPage() {
  // ActivityScreen reads its filters from the query string (useSearchParams).
  return (
    <Suspense>
      <ActivityScreen />
    </Suspense>
  );
}
