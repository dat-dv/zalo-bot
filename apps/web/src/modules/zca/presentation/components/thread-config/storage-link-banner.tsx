'use client';

const TONE = {
  drive: {
    box: 'border-blue-100 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/30',
    code: 'border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300',
    button: 'bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500',
  },
  photos: {
    box: 'border-indigo-200/80 bg-indigo-50/70 dark:border-indigo-900/40 dark:bg-indigo-950/30',
    code: 'border-indigo-200 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300',
    button: 'bg-indigo-600 hover:bg-indigo-700 dark:hover:bg-indigo-500',
  },
} as const;

interface StorageLinkBannerProps {
  kind: keyof typeof TONE;
  icon: string;
  label: string;
  value: string;
  description: string;
  buttonLabel: string;
  buttonTitle: string;
  onOpen: () => void;
}

/** Where this chat's media goes, plus a button opening every root it has used. */
export function StorageLinkBanner({
  kind,
  icon,
  label,
  value,
  description,
  buttonLabel,
  buttonTitle,
  onOpen,
}: StorageLinkBannerProps) {
  const tone = TONE[kind];
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${tone.box}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="text-lg">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {label}
            </span>
            <code
              className={`break-all rounded border bg-white px-1.5 py-0.5 font-mono text-xs font-medium dark:bg-slate-900 ${tone.code}`}
            >
              {value}
            </code>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      <button
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors max-[640px]:h-10 ${tone.button}`}
        onClick={onOpen}
        title={buttonTitle}
        type="button"
      >
        <span>{buttonLabel}</span>
        <span aria-hidden="true">↗</span>
      </button>
    </div>
  );
}
