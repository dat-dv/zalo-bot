import type { Metadata } from 'next';
import { RecurringScreen } from '@/modules/recurring/view/recurring-screen';

export const metadata: Metadata = {
  title: 'Khoản cố định',
  description: 'Tiền nhà, điện nước, lương và các khoản lặp lại theo kỳ.',
};

export default function RecurringPage() {
  return <RecurringScreen />;
}
