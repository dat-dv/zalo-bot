'use client';

import { useLocale } from '@/shared/providers/locale-provider';
import { useSavingsVisibilityStore } from '@/shared/store/savings-visibility-store';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { MoneyVisibilityIcon } from '@/shared/ui/money-visibility-icon';
import { PHONE_CHIP } from '@/shared/ui/touch';

/** The eye of savings amounts, independent from the global amounts switch. */
export function SavingsVisibilityToggle() {
  const { t } = useLocale();
  const isSavingsVisible = useSavingsVisibilityStore((state) => state.isSavingsVisible);
  const toggle = useSavingsVisibilityStore((state) => state.toggleSavingsVisibility);
  const label = t(isSavingsVisible ? 'savings.hideAmounts' : 'savings.showAmounts');

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isSavingsVisible}
      onClick={toggle}
      title={label}
      className={`inline-flex h-6 min-h-6 w-7 shrink-0 items-center justify-center ${PHONE_CHIP} rounded-[3px] border ${
        isSavingsVisible ? BUTTON_TONE.chipSelected : BUTTON_TONE.chip
      }`}
    >
      <MoneyVisibilityIcon visible={isSavingsVisible} />
    </button>
  );
}
