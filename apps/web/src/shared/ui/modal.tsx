'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '@/shared/hooks/use-body-scroll-lock';
import { useVisualViewportVars } from '@/shared/hooks/use-visual-viewport';

/** Keep dialog headers visible while the panel body scrolls. Pair with a solid background. */
export const MODAL_STICKY_HEADER = 'sticky top-0 z-10';
/** Keep dialog actions reachable above the on-screen keyboard. Pair with a solid background. */
export const MODAL_STICKY_FOOTER = 'sticky bottom-0 z-10';

const LAYER_CLASS = {
  base: 'z-[900]',
  // Dialogs that can open on top of another dialog (e.g. the DataTable ID explainer).
  top: 'z-[950]',
} as const;

// Wait for the on-screen keyboard animation before revealing the focused field.
const KEYBOARD_SETTLE_MS = 300;
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Only the top-most open dialog reacts to Escape / Tab.
const openStack: symbol[] = [];

interface ModalProps {
  open: boolean;
  /** Called on Escape and, when `dismissOnBackdrop`, on backdrop click. Omit to make the dialog non-dismissible. */
  onDismiss?: () => void;
  dismissOnBackdrop?: boolean;
  labelledBy?: string;
  describedBy?: string;
  ariaLabel?: string;
  role?: 'dialog' | 'alertdialog';
  layer?: keyof typeof LAYER_CLASS;
  /** Visual styling of the panel: width cap, border, radius, background. */
  panelClassName: string;
  backdropClassName?: string;
  children: ReactNode;
}

/**
 * Shared dialog shell. Desktop: centered panel. Mobile (< 640px): bottom sheet
 * pinned to the bottom edge. The overlay tracks the visual viewport so the
 * panel stays above the on-screen keyboard, and the panel itself scrolls when
 * content is taller than the visible area.
 */
export function Modal({
  open,
  onDismiss,
  dismissOnBackdrop = false,
  labelledBy,
  describedBy,
  ariaLabel,
  role = 'dialog',
  layer = 'base',
  panelClassName,
  backdropClassName = 'bg-slate-900/60 backdrop-blur-xs dark:bg-slate-950/80',
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useBodyScrollLock(open);
  useVisualViewportVars(open);

  useEffect(() => {
    if (!open) return;
    const token = Symbol('modal');
    openStack.push(token);
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    // Focus the panel, not a field: focusing an input would pop the mobile keyboard.
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus({ preventScroll: true });
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== token || !panel) return;
      if (event.key === 'Escape' && dismissRef.current) {
        event.stopPropagation();
        dismissRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    let revealTimer = 0;
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLTextAreaElement) &&
        !(target instanceof HTMLSelectElement)
      ) {
        return;
      }
      window.clearTimeout(revealTimer);
      revealTimer = window.setTimeout(() => {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }, KEYBOARD_SETTLE_MS);
    };

    document.addEventListener('keydown', handleKeyDown);
    panel?.addEventListener('focusin', handleFocusIn);
    return () => {
      window.clearTimeout(revealTimer);
      document.removeEventListener('keydown', handleKeyDown);
      panel?.removeEventListener('focusin', handleFocusIn);
      const index = openStack.indexOf(token);
      if (index >= 0) openStack.splice(index, 1);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-x-0 top-[var(--app-vv-top,0px)] flex h-[var(--app-vvh,100dvh)] items-center justify-center p-4 max-sm:items-end max-sm:p-0 max-sm:pt-6 ${LAYER_CLASS[layer]}`}
      role="presentation"
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 ${backdropClassName}`}
        onClick={dismissOnBackdrop ? () => dismissRef.current?.() : undefined}
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`relative flex max-h-full w-full flex-col overflow-y-auto overscroll-contain shadow-2xl outline-none ${panelClassName} max-sm:max-w-none max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[env(safe-area-inset-bottom)]`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
