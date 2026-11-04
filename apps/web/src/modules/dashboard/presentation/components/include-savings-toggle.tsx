'use client';

import { useLocale } from '@/shared/providers/locale-provider';
import { useIncludeSavingsStore } from '@/shared/store/include-savings-store';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { PHONE_CHIP } from '@/shared/ui/touch';

/** Only switches which balance is shown; nothing is written. */
export function IncludeSavingsToggle() {
  const { t } = useLocale();
  const includeSavings = useIncludeSavingsStore((state) => state.includeSavings);
  const toggle = useIncludeSavingsStore((state) => state.toggleIncludeSavings);

  return (
    <button
      type="button"
      aria-pressed={includeSavings}
      onClick={toggle}
      className={`inline-flex h-6 min-h-6 shrink-0 items-center whitespace-nowrap ${PHONE_CHIP} rounded-[3px] border px-2 text-[11px] font-medium ${
        includeSavings ? BUTTON_TONE.chipSelected : BUTTON_TONE.chip
      }`}
    >
      {t('savings.includeToggle')}
    </button>
  );
}
