'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useIsPhone } from '@/shared/hooks/use-media-query';
import { useLocale } from '@/shared/providers/locale-provider';
import { MODAL_STICKY_HEADER, Modal } from '@/shared/ui/modal';

const POPOVER_WIDTH = 240;
const TEXT_DEBOUNCE_MS = 400;
/** Option lists longer than this get a search box. */
const OPTION_SEARCH_THRESHOLD = 8;

type ColumnFilterHeaderProps = {
  label: string;
  /** Render only the funnel button, for headers that draw their own label. */
  hideLabel?: boolean;
  active: boolean;
  onClear: () => void;
  align?: 'left' | 'right';
  children: ReactNode;
};

/**
 * Column header label plus a funnel button opening the column's filter. The panel is portalled to
 * the body because the table scroller would clip it. On phones it opens in the shared `Modal`
 * bottom sheet instead (backdrop, scroll lock, touch dismissal).
 */
export function ColumnFilterHeader({
  label,
  hideLabel = false,
  active,
  onClear,
  align = 'left',
  children,
}: ColumnFilterHeaderProps) {
  const { t } = useLocale();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const isPhone = useIsPhone();

  useEffect(() => {
    if (!isOpen || isPhone) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const preferredLeft = align === 'right' ? rect.right - POPOVER_WIDTH : rect.left;
      const left = Math.min(Math.max(8, preferredLeft), window.innerWidth - POPOVER_WIDTH - 8);
      setPosition({ left, top: rect.bottom + 4, width: POPOVER_WIDTH });
    };
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      buttonRef.current?.focus();
    };

    updatePosition();
    // Prefer the first field over the header's "Clear filter" button, so typing works right away.
    const panel = panelRef.current;
    (
      panel?.querySelector<HTMLElement>('input') ?? panel?.querySelector<HTMLElement>('button')
    )?.focus();
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, isPhone, align]);

  const buttonLabel = t('table.columnFilter.open', { column: label });

  const panelHeader = (
    <div
      className={`flex items-center justify-between gap-2 border-b border-slate-200 px-2.5 py-1.5 dark:border-slate-800 max-sm:bg-white max-sm:pt-3 max-sm:pb-1 dark:max-sm:bg-slate-900 ${isPhone ? MODAL_STICKY_HEADER : ''}`}
    >
      <span className="truncate font-semibold text-slate-900 dark:text-slate-100">{label}</span>
      <button
        type="button"
        onClick={onClear}
        disabled={!active}
        className="shrink-0 cursor-pointer text-[11px] font-medium text-sky-700 hover:underline disabled:cursor-default disabled:text-slate-400 disabled:no-underline max-sm:h-10 max-sm:px-2 dark:text-sky-400 dark:disabled:text-slate-600"
      >
        {t('table.columnFilter.clear')}
      </button>
    </div>
  );

  return (
    <span
      className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}
    >
      {!hideLabel && <span>{label}</span>}
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((open) => !open);
        }}
        aria-label={buttonLabel}
        title={buttonLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen && !isPhone ? panelId : undefined}
        className={`relative inline-flex size-5 cursor-pointer items-center max-[640px]:size-10 justify-center rounded-[3px] border normal-case transition-colors ${
          active
            ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-500 dark:bg-sky-950/60 dark:text-sky-300'
            : 'border-transparent text-slate-400 hover:border-slate-300 hover:bg-white hover:text-slate-700 dark:text-slate-500 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <svg viewBox="0 0 16 16" className="size-3" fill="currentColor" aria-hidden="true">
          <path d="M1.5 2.5h13l-5 6v4.25l-3 1.75v-6z" />
        </svg>
        {active && (
          <span
            className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-sky-600 dark:bg-sky-400"
            aria-hidden="true"
          />
        )}
      </button>

      {isPhone ? (
        <Modal
          open={isOpen}
          onDismiss={() => setIsOpen(false)}
          dismissOnBackdrop
          ariaLabel={buttonLabel}
          panelClassName="rounded-t-[4px] border-t border-slate-300 bg-white text-[11.5px] font-normal tracking-normal text-slate-700 normal-case dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {panelHeader}
          <div className="p-2.5 pb-4">{children}</div>
        </Modal>
      ) : isOpen && typeof document !== 'undefined' ? (
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={buttonLabel}
            style={position}
            className="fixed z-[100] flex max-h-[min(24rem,70vh)] flex-col rounded-[4px] border border-slate-300 bg-white text-[11.5px] font-normal tracking-normal text-slate-700 normal-case shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {panelHeader}
            <div className="min-h-0 flex-1 overflow-y-auto p-2.5">{children}</div>
          </div>,
          document.body,
        )
      ) : null}
    </span>
  );
}

const INPUT_CLASS =
  'h-7 min-h-7 max-sm:h-10 max-sm:min-h-10 w-full rounded-[3px] border border-slate-300 bg-white px-2 text-[11.5px] text-slate-900 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-sky-500';

export type FilterOption = { value: string; label: string };

type OptionsFilterProps = {
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
};

/** Multi-select checkbox list; selected values missing from `options` stay visible and removable. */
export function OptionsFilter({ options, selected, onChange }: OptionsFilterProps) {
  const { t } = useLocale();
  const [query, setQuery] = useState('');

  const allOptions = useMemo(() => {
    const known = new Set(options.map((option) => option.value));
    const orphans = selected
      .filter((value) => !known.has(value))
      .map((value) => ({ value, label: value }));
    return [...orphans, ...options];
  }, [options, selected]);
  const visibleOptions = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return allOptions;
    return allOptions.filter((option) => option.label.toLocaleLowerCase().includes(needle));
  }, [allOptions, query]);

  const toggle = (value: string) =>
    onChange(
      selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value],
    );

  return (
    <div className="flex flex-col gap-1.5">
      {allOptions.length > OPTION_SEARCH_THRESHOLD && (
        <input
          type="search"
          className={INPUT_CLASS}
          placeholder={t('table.columnFilter.search')}
          aria-label={t('table.columnFilter.search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      {visibleOptions.length === 0 ? (
        <p className="py-2 text-center text-slate-400 dark:text-slate-500">
          {t('table.columnFilter.noOptions')}
        </p>
      ) : (
        <ul className="flex flex-col">
          {visibleOptions.map((option) => (
            <li key={option.value}>
              <label className="flex cursor-pointer items-center gap-2 rounded-[3px] px-1 py-1 hover:bg-slate-50 max-sm:min-h-10 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  className="size-3.5 accent-sky-600"
                  checked={selected.includes(option.value)}
                  onChange={() => toggle(option.value)}
                />
                <span className="truncate" title={option.label}>
                  {option.label}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Local draft that reports upstream after the user pauses typing. */
function useDebouncedDraft(value: string, onCommit: (next: string) => void) {
  const [draft, setDraft] = useState(value);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  // Follow external resets (e.g. "Clear filter") without clobbering in-progress typing.
  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => commitRef.current(draft), TEXT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value]);

  return [draft, setDraft] as const;
}

type TextFilterProps = { value: string; onChange: (next: string) => void };

export function TextFilter({ value, onChange }: TextFilterProps) {
  const { t } = useLocale();
  const [draft, setDraft] = useDebouncedDraft(value, onChange);
  return (
    <input
      type="search"
      className={INPUT_CLASS}
      placeholder={t('table.columnFilter.contains')}
      aria-label={t('table.columnFilter.contains')}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onChange(draft);
      }}
    />
  );
}

type RangeFilterProps = {
  min: string;
  max: string;
  onChange: (next: { min: string; max: string }) => void;
};

export function RangeFilter({ min, max, onChange }: RangeFilterProps) {
  const { t } = useLocale();
  const [minDraft, setMinDraft] = useDebouncedDraft(min, (next) => onChange({ min: next, max }));
  const [maxDraft, setMaxDraft] = useDebouncedDraft(max, (next) => onChange({ min, max: next }));
  const digitsOnly = (value: string) => value.replace(/\D/g, '');
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
          {t('table.columnFilter.min')}
        </span>
        <input
          type="text"
          inputMode="numeric"
          className={`${INPUT_CLASS} text-right tabular-nums`}
          value={minDraft}
          onChange={(event) => setMinDraft(digitsOnly(event.target.value))}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
          {t('table.columnFilter.max')}
        </span>
        <input
          type="text"
          inputMode="numeric"
          className={`${INPUT_CLASS} text-right tabular-nums`}
          value={maxDraft}
          onChange={(event) => setMaxDraft(digitsOnly(event.target.value))}
        />
      </label>
    </div>
  );
}

type ChoiceFilterProps<T extends string> = {
  name: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
};

export function ChoiceFilter<T extends string>({
  name,
  options,
  value,
  onChange,
}: ChoiceFilterProps<T>) {
  return (
    <div role="radiogroup" className="flex flex-col">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center gap-2 rounded-[3px] px-1 py-1 hover:bg-slate-50 max-sm:min-h-10 dark:hover:bg-slate-800"
        >
          <input
            type="radio"
            name={name}
            className="size-3.5 accent-sky-600"
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
