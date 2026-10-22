'use client';

type SwitchSize = 'lg' | 'md' | 'sm';
type SwitchTone = 'blue' | 'emerald';

const TRACK_SIZE: Record<SwitchSize, string> = {
  lg: 'h-6 w-11 after:top-[2px] after:left-[2px] after:size-5',
  md: 'h-5 w-9 after:top-[2px] after:left-[2px] after:size-4',
  sm: 'h-4 w-7 after:top-[1px] after:left-[1px] after:size-3.5',
};

const TRACK_TONE: Record<SwitchTone, string> = {
  blue: 'peer-checked:bg-blue-600',
  emerald: 'peer-checked:bg-emerald-600',
};

interface ConfigSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name; the switch has no visible text of its own. */
  label: string;
  size?: SwitchSize;
  tone?: SwitchTone;
}

export function ConfigSwitch({
  checked,
  onChange,
  label,
  size = 'md',
  tone = 'blue',
}: ConfigSwitchProps) {
  return (
    // Phones: 40px tap area around the unchanged track.
    <label className="relative inline-flex shrink-0 cursor-pointer items-center max-[640px]:min-h-10 max-[640px]:min-w-10 max-[640px]:justify-center">
      <input
        aria-label={label}
        checked={checked}
        className="peer sr-only"
        onChange={(e) => onChange(e.target.checked)}
        role="switch"
        type="checkbox"
      />
      <div
        className={`peer rounded-full bg-slate-300 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-1 dark:bg-slate-700 after:absolute after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full ${TRACK_SIZE[size]} ${TRACK_TONE[tone]}`}
      />
    </label>
  );
}
