import type { Metadata } from 'next';
import { ZcaScreen } from '@/modules/zca/view/zca-screen';

export const metadata: Metadata = {
  title: 'Zalo & Người dùng | Zalo Bot Assistant',
  description:
    'Kết nối Zalo cá nhân (ZCA), quản lý cuộc trò chuyện được lắng nghe và cấp quyền tương tác cho người dùng',
};

export default function ZcaPage() {
  return <ZcaScreen />;
}
