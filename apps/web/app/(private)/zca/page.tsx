import type { Metadata } from 'next';
import { ZcaScreen } from '@/modules/zca/view/zca-screen';

export const metadata: Metadata = {
  title: 'Tài khoản Zalo cá nhân (ZCA) & Whitelist | Zalo Bot Assistant',
  description: 'Quản lý kết nối Zalo cá nhân và danh sách lắng nghe tin nhắn ZCA',
};

export default function ZcaPage() {
  return <ZcaScreen />;
}
