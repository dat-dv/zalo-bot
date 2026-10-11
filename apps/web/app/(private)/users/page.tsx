import type { Metadata } from 'next';
import { UsersScreen } from '@/modules/users/view/users-screen';

export const metadata: Metadata = {
  title: 'Quản lý người dùng & Whitelist | Zalo Bot Assistant',
  description: 'Quản lý danh sách người dùng và cấp quyền truy cập Zalo Bot',
};

export default function UsersPage() {
  return <UsersScreen />;
}
