import type { Metadata } from 'next';
import { SavingsScreen } from '@/modules/savings/view/savings-screen';

export const metadata: Metadata = {
  title: 'Nhóm tiết kiệm',
  description: 'Quản lý các nhóm tiết kiệm, tiền trong nhóm nằm ngoài số dư ví.',
};

export default function SavingsPage() {
  return <SavingsScreen />;
}
