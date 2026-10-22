import type { Metadata } from 'next';
import { GoogleStorageScreen } from '@/modules/zca/view/google-storage-screen';

export const metadata: Metadata = {
  title: 'Google Drive | Zalo Bot Assistant',
  description:
    'Tài khoản Google lưu trữ media của mọi kênh Zalo: xem, đăng nhập, đổi và đăng xuất.',
};

export default function GoogleStoragePage() {
  return <GoogleStorageScreen />;
}
