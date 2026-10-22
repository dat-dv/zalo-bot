'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { APP_ROUTES } from '@zalobot/contracts';
import { apiErrorMessage } from '@/modules/users/api/api-error-message';
import { getUserLinkedContacts } from '@/modules/users/api/users-api';
import { useLocale } from '@/shared/providers/locale-provider';
import { createContact } from '../api/contacts-api';

export interface ProfileUser {
  id: string;
  name: string;
  phoneNumber?: string;
  linkedContactCount: number;
}

/**
 * Opens the profile of a Zalo user. A profile is rooted at the contact linked to the user (at
 * most one per user); when there is none yet, one is created and linked first (admin only).
 */
export function useOpenContactProfile() {
  const router = useRouter();
  const { t } = useLocale();

  return useCallback(
    async (user: ProfileUser) => {
      try {
        const linked = user.linkedContactCount > 0 ? await getUserLinkedContacts(user.id) : [];
        const contactId =
          linked[0]?.contactId ??
          (
            await createContact({
              displayName: user.name.trim() || user.id,
              phoneNumber: user.phoneNumber || undefined,
              linkedUserId: user.id,
            })
          ).id;
        router.push(APP_ROUTES.contactProfile(contactId));
      } catch (error: unknown) {
        window.alert(`${t('zca.profile.createError')} (${apiErrorMessage(error)})`);
      }
    },
    [router, t],
  );
}
