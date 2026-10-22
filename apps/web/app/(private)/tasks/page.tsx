import type { Metadata } from 'next';
import { TasksScreen } from '@/modules/dashboard/view/tasks-screen';

export const metadata: Metadata = {
  title: 'Việc cần làm',
  description: 'Danh sách việc cần làm dùng chung, lưu trong zalobot.',
};

export default function TasksPage() {
  return <TasksScreen />;
}
