'use client';

import { useId, type InputHTMLAttributes } from 'react';

interface ConfigFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> {
  label: string;
  hint?: string;
  className?: string;
}

/** Labelled text/number input with a hint line below it. */
export function ConfigField({ label, hint, className = '', ...inputProps }: ConfigFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={`min-w-0 ${className}`}>
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor={id}>
        {label}
      </label>
      <input
        aria-describedby={hint ? hintId : undefined}
        className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm max-[640px]:h-10 text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        id={id}
        {...inputProps}
      />
      {hint && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}
