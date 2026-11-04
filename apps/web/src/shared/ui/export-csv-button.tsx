'use client';

import { useState } from 'react';
import { useLocale } from '@/shared/providers/locale-provider';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { PHONE_CHIP } from '@/shared/ui/touch';

/** Saves a blob; the API is cross-origin and token-based, so a plain link cannot download it. */
function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ExportCsvButton({
  filePrefix,
  download,
  onError,
}: {
  filePrefix: string;
  download: () => Promise<Blob>;
  onError: (message: string) => void;
}) {
  const { t } = useLocale();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const date = new Date().toLocaleDateString('en-CA');
      saveBlob(await download(), `${filePrefix}-${date}.csv`);
    } catch {
      onError(t('table.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      type="button"
      disabled={isExporting}
      onClick={() => void handleExport()}
      className={`inline-flex h-6 min-h-6 shrink-0 items-center justify-center whitespace-nowrap ${PHONE_CHIP} rounded-[3px] border px-2 text-[11px] font-semibold ${BUTTON_TONE.chip}`}
    >
      {isExporting ? t('table.exporting') : t('table.exportCsv')}
    </button>
  );
}
