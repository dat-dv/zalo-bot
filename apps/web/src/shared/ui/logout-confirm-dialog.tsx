'use client';

import { useLocale } from '@/shared/providers/locale-provider';
import { ConfirmDialog } from './confirm-dialog';

interface LogoutConfirmDialogProps {
  open: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Asks before ending the dashboard session: getting back in needs a new sign-in link
 * from the Zalo Bot. Opened from the desktop header and from the phone "More" sheet.
 */
export function LogoutConfirmDialog({
  open,
  isPending,
  onCancel,
  onConfirm,
}: LogoutConfirmDialogProps) {
  const { t } = useLocale();
  return (
    <ConfirmDialog
      open={open}
      title={t('common.logoutConfirm.title')}
      message={t('common.logoutConfirm.message')}
      confirmLabel={t('common.logout')}
      pendingLabel={t('common.loggingOut')}
      isPending={isPending}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
