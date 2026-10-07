'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

type CategoryAutocompleteProps = {
  ariaLabel: string;
  autoFocus?: boolean;
  onCancel: () => void;
  onChange: (value: string) => void;
  onConfirm: () => void;
  options: string[];
  placeholder: string;
  value: string;
};

export function CategoryAutocomplete({
  ariaLabel,
  autoFocus,
  onCancel,
  onChange,
  onConfirm,
  options,
  placeholder,
  value,
}: CategoryAutocompleteProps) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0, width: 0 });

  const filteredOptions = useMemo(() => {
    const query = value.trim().toLocaleLowerCase();
    return options.filter((option) => option.toLocaleLowerCase().includes(query));
  }, [options, value]);

  const updateMenuPosition = () => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPosition({ left: rect.left, top: rect.bottom + 4, width: rect.width });
  };

  useEffect(() => {
    if (!isOpen) return;

    updateMenuPosition();
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    const handleViewportChange = () => updateMenuPosition();

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [value, options]);

  const selectOption = (option: string) => {
    onChange(option);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter' && isOpen && filteredOptions[activeIndex]) {
      event.preventDefault();
      selectOption(filteredOptions[activeIndex]);
      return;
    }
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      return;
    }
    if (event.key === 'Enter') onConfirm();
    if (event.key === 'Escape') onCancel();
  };

  return (
    <div className="relative block" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        className="h-6 min-h-6 w-full rounded-[2px] border border-sky-600 bg-white px-1.5 pr-5 text-[11.5px] text-slate-900 shadow-[0_0_0_1px_rgba(2,132,199,0.2)] outline-none focus:border-sky-700 focus:shadow-[0_0_0_2px_rgba(2,132,199,0.25)] dark:border-sky-400 dark:bg-slate-950 dark:text-slate-100"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onClick={() => setIsOpen(true)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        required
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-activedescendant={
          isOpen && filteredOptions[activeIndex] ? `${inputId}-${activeIndex}` : undefined
        }
      />
      <span
        className="pointer-events-none absolute top-1 right-1.5 text-sm leading-none text-slate-400 dark:text-slate-500"
        aria-hidden="true"
      >
        ⌄
      </span>

      {isOpen && filteredOptions.length > 0 && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              id={listboxId}
              className="fixed z-[100] max-h-48 overflow-y-auto rounded-[3px] border border-sky-600 bg-white shadow-2xl dark:border-sky-500 dark:bg-slate-900"
              role="listbox"
              aria-label={ariaLabel}
              style={menuPosition}
            >
              {filteredOptions.map((option, index) => (
                <div
                  key={option}
                  id={`${inputId}-${index}`}
                  className={`cursor-pointer px-2 py-1 text-[11.5px] leading-tight transition-colors ${
                    index === activeIndex
                      ? 'bg-sky-100 font-medium text-sky-900 dark:bg-sky-950 dark:text-sky-200'
                      : 'text-slate-700 hover:bg-sky-50 hover:text-sky-900 dark:text-slate-200 dark:hover:bg-sky-950/60 dark:hover:text-sky-200'
                  }`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option)}
                >
                  {option}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
