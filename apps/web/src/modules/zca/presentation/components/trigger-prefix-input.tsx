'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import {
  TRIGGER_PREFIX_LIMITS,
  validateTriggerPrefix,
  type TriggerPrefixError,
} from '@zalobot/contracts';
import { BUTTON_TONE } from '@/shared/ui/button-styles';

const ERROR_MESSAGES: Record<TriggerPrefixError, string> = {
  empty: 'Nhập tiền tố trước khi thêm.',
  whitespace: 'Tiền tố không được chứa dấu cách.',
  too_long: `Tiền tố tối đa ${TRIGGER_PREFIX_LIMITS.MAX_LENGTH} ký tự.`,
  duplicate: 'Tiền tố này đã có (không phân biệt hoa thường).',
  too_many: `Tối đa ${TRIGGER_PREFIX_LIMITS.MAX_COUNT} tiền tố.`,
};

interface TriggerPrefixInputProps {
  value: readonly string[];
  onChange: (prefixes: string[]) => void;
}

/** Chip input: Enter, comma or the add button commits a prefix; × removes one. */
export function TriggerPrefixInput({ value, onChange }: TriggerPrefixInputProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<TriggerPrefixError | null>(null);

  const commit = () => {
    const nextError = validateTriggerPrefix(draft, value);
    if (nextError) {
      setError(nextError);
      return;
    }
    onChange([...value, draft.trim()]);
    setDraft('');
    setError(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const hasSlash = value.includes('/');

  return (
    <div>
      <label
        className="text-[11px] font-medium text-slate-600 dark:text-slate-400"
        htmlFor={inputId}
      >
        Tiền tố gọi bot nhanh
      </label>
      <div
        className={`mt-1 flex flex-wrap items-center gap-1.5 rounded border bg-white px-2 py-1.5 focus-within:border-blue-500 dark:bg-slate-800 ${
          error ? 'border-rose-400 dark:border-rose-500' : 'border-slate-300 dark:border-slate-700'
        }`}
      >
        {value.map((prefix) => (
          <span
            className="inline-flex items-center gap-1 rounded bg-blue-50 py-0.5 pr-1 pl-2 font-mono text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            key={prefix}
          >
            {prefix}
            <button
              aria-label={`Xoá tiền tố ${prefix}`}
              className="rounded px-1 leading-none text-blue-500 max-[640px]:-my-2 max-[640px]:-mr-1 max-[640px]:inline-flex max-[640px]:size-10 max-[640px]:items-center max-[640px]:justify-center hover:bg-blue-100 hover:text-blue-800 dark:hover:bg-blue-900 dark:hover:text-blue-100"
              onClick={() => onChange(value.filter((item) => item !== prefix))}
              type="button"
            >
              ×
            </button>
          </span>
        ))}
        <input
          aria-describedby={hintId}
          aria-invalid={error !== null}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-xs max-[640px]:h-10 text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
          id={inputId}
          maxLength={TRIGGER_PREFIX_LIMITS.MAX_LENGTH + 1}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? 'VD: !  hoặc  bot:  rồi nhấn Enter' : 'Thêm tiền tố…'}
          type="text"
          value={draft}
        />
        <button
          className={`rounded px-2 py-0.5 text-xs font-medium max-[640px]:h-10 max-[640px]:px-3 ${BUTTON_TONE.accent}`}
          disabled={!draft.trim()}
          onClick={commit}
          type="button"
        >
          Thêm
        </button>
      </div>
      <p
        className={`mt-0.5 text-[10px] ${error ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}
        id={hintId}
        role={error ? 'alert' : undefined}
      >
        {error
          ? ERROR_MESSAGES[error]
          : `Trong nhóm, tin nhắn phải @Bot hoặc bắt đầu bằng một tiền tố (không phân biệt hoa thường, không có dấu cách). Tối đa ${TRIGGER_PREFIX_LIMITS.MAX_COUNT} tiền tố.`}
      </p>
      {hasSlash && (
        <p className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400">
          Tiền tố “/” sẽ bị cắt khỏi lệnh slash (ví dụ /dashboard thành dashboard).
        </p>
      )}
    </div>
  );
}
