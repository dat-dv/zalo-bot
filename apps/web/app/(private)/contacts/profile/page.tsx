import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ContactProfileScreen } from '@/modules/contacts/view/contact-profile-screen';

export const metadata: Metadata = {
  title: 'Hồ sơ người liên quan',
  description: 'Thông tin, khoản nợ và giao dịch của một người liên quan.',
};

// `useSearchParams` needs a Suspense boundary in a statically exported page.
export default function ContactProfilePage() {
  return (
    <Suspense>
      <ContactProfileScreen />
    </Suspense>
  );
}
