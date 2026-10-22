'use client';

import {
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useBodyScrollLock } from '@/shared/hooks/use-body-scroll-lock';
import { useIsPhone } from '@/shared/hooks/use-media-query';
import { useSwipeDismiss } from '@/shared/hooks/use-swipe-dismiss';
import { PHONE_MEDIA_QUERY } from '@/shared/ui/breakpoints';
import {
  EASE_SHEET_IN,
  EASE_SHEET_OUT,
  MOTION_MS,
  cardEnter,
  cardExit,
  fadeIn,
  fadeOut,
  sheetEnter,
  sheetExit,
} from '@/shared/ui/motion';
import { useVisualViewportVars } from '@/shared/hooks/use-visual-viewport';

/** Keep dialog headers visible while the panel body scrolls. Pair with a solid background. */
export const MODAL_STICKY_HEADER = 'sticky top-0 z-10';
/**
 * Keep dialog actions reachable above the on-screen keyboard. Pair with a solid background.
 * `mt-auto` pins the row to the bottom of a full-screen phone dialog whose content is short.
 */
export const MODAL_STICKY_FOOTER = 'sticky bottom-0 z-10 mt-auto';
/** Append to a dialog's close (✕) button: 40×40px tap target on phones, desktop size unchanged. */
export const MODAL_CLOSE_TAP =
  'max-sm:inline-flex max-sm:size-10 max-sm:items-center max-sm:justify-center';
/** Append to each footer action button: 40px tall and sharing the row evenly on phones. */
export const MODAL_FOOTER_TAP = 'max-sm:h-10 max-sm:min-h-10 max-sm:flex-1';

// Wait for the on-screen keyboard animation before revealing the focused field.
const KEYBOARD_SETTLE_MS = 300;
// Keep the dialog mounted this long after `open` turns false so it can slide/fade out.
const EXIT_MS = MOTION_MS.sheetOut;
// A sheet is dragged by its top strip (grab bar + header); lower touches scroll the content.
const SHEET_DRAG_ZONE_PX = 64;
// Full-screen phone panel. A wrapping <form> grows to the panel height so the footer inside
// it (MODAL_STICKY_FOOTER, `mt-auto`) sits at the bottom edge even when the form is short.
const FULLSCREEN_PANEL =
  'max-sm:h-full max-sm:rounded-none max-sm:border-t-0 max-sm:pt-[env(safe-area-inset-top)] max-sm:[&>form]:flex max-sm:[&>form]:flex-[1_0_auto] max-sm:[&>form]:flex-col';

interface ModalProps {
  open: boolean;
  /** Called on Escape and, when `dismissOnBackdrop`, on backdrop click. Omit to make the dialog non-dismissible. */
  onDismiss?: () => void;
  dismissOnBackdrop?: boolean;
  labelledBy?: string;
  describedBy?: string;
  ariaLabel?: string;
  role?: 'dialog' | 'alertdialog';
  /** Visual styling of the panel: width cap, border, radius, background. */
  panelClassName: string;
  backdropClassName?: string;
  /** Phone layout (< 640px): a bottom sheet by default; long forms can take the full screen. */
  phoneLayout?: 'sheet' | 'fullscreen';
  children: ReactNode;
}

/**
 * Shared dialog shell built on the native `<dialog>` + `showModal()`: the
 * browser provides the top layer (no z-index juggling, later dialogs stack
 * above earlier ones), makes the rest of the page inert, routes Escape to the
 * top-most dialog via `cancel`, and restores focus on close.
 *
 * Still handled here because the platform does not: page scroll lock, sizing
 * to the visual viewport so the panel stays above the on-screen keyboard, the
 * mobile bottom-sheet layout (< 640px), revealing focused fields, enter/exit motion and
 * swipe-down-to-dismiss on phone sheets.
 */
export function Modal({
  open,
  onDismiss,
  dismissOnBackdrop = false,
  labelledBy,
  describedBy,
  ariaLabel,
  role = 'dialog',
  panelClassName,
  backdropClassName = 'bg-slate-900/60 backdrop-blur-xs dark:bg-slate-950/80',
  phoneLayout = 'sheet',
  children,
}: ModalProps) {
  const isFullscreen = phoneLayout === 'fullscreen';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  // `rendered` outlives `open` by EXIT_MS so the exit transition can play.
  const [rendered, setRendered] = useState(open);
  if (open && !rendered) setRendered(true);
  const closing = rendered && !open;
  useEffect(() => {
    if (!closing) return;
    // Phones: the sheet drops from where it is (mid-swipe included); larger screens fade.
    if (window.matchMedia(PHONE_MEDIA_QUERY).matches) sheetExit(panelRef.current);
    else cardExit(panelRef.current);
    // The backdrop moves in step with the sheet (same duration and curve).
    fadeOut(backdropRef.current, MOTION_MS.sheetOut, EASE_SHEET_OUT);
    const timer = window.setTimeout(() => setRendered(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);

  useBodyScrollLock(rendered);
  useVisualViewportVars(rendered);

  const isPhone = useIsPhone();
  useSwipeDismiss({
    surfaceRef: panelRef,
    axis: 'y',
    direction: 1,
    enabled: open && isPhone && !isFullscreen && Boolean(onDismiss),
    onDismiss: () => dismissRef.current?.(),
    canStart: (touch, panel) =>
      touch.clientY - panel.getBoundingClientRect().top < SHEET_DRAG_ZONE_PX,
  });

  // Layout effect: open before paint and close while the element is still attached,
  // so the browser restores focus to the opener.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    if (!rendered || !dialog || !panel) return;
    // showModal() focuses the first focusable descendant, which may be an input and
    // would pop the mobile keyboard. An `autofocus` panel takes precedence over it.
    panel.setAttribute('autofocus', '');
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.open) dialog.showModal();
    // Web Animations rather than CSS @starting-style: it also runs on iOS < 17.5.
    if (window.matchMedia(PHONE_MEDIA_QUERY).matches) sheetEnter(panel);
    else cardEnter(panel);
    fadeIn(backdropRef.current, MOTION_MS.sheetIn, EASE_SHEET_IN);
    return () => {
      if (dialog.open) dialog.close();
      // When `open` flips to false on a mounted Modal, React detaches the <dialog> before
      // this cleanup runs, so the browser cannot restore focus itself.
      const focusLost = !document.activeElement || document.activeElement === document.body;
      if (focusLost && opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [rendered]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
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
    panel.addEventListener('focusin', handleFocusIn);
    return () => {
      window.clearTimeout(revealTimer);
      panel.removeEventListener('focusin', handleFocusIn);
    };
  }, [open]);

  // Escape: React owns the open state, so never let the browser close the dialog itself.
  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (open) dismissRef.current?.();
  };

  // Browsers may force-close after repeated cancels without user activation. Keep the
  // DOM in sync with `open`: dismiss if allowed, otherwise reopen.
  const handleClose = () => {
    const dialog = dialogRef.current;
    if (!open || !dialog || dialog.open) return;
    if (dismissRef.current) {
      dismissRef.current();
    } else {
      dialog.showModal();
    }
  };

  if (!rendered) return null;

  return (
    <dialog
      ref={dialogRef}
      role={role === 'alertdialog' ? 'alertdialog' : undefined}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-label={ariaLabel}
      onCancel={handleCancel}
      onClose={handleClose}
      // Reset UA dialog styles (margin, max size, border, padding, colors) and size the
      // dialog to the visual viewport; the panel sits inside as centered card / bottom sheet.
      // `overflow: clip`, not `hidden`: a hidden box is still a scroll container, and the
      // sheet starting at translateY(100%) made it scrollable, so WebKit could scroll it to
      // the focused panel and the sheet jumped up, then dropped as the scroll clamped back.
      className={`fixed inset-x-0 top-[var(--app-vv-top,0px)] bottom-auto m-0 h-[var(--app-vvh,100dvh)] max-h-none w-full max-w-none items-center justify-center overflow-hidden supports-[overflow:clip]:overflow-clip border-0 bg-transparent p-4 text-inherit backdrop:bg-transparent open:flex max-sm:items-end max-sm:p-0 ${isFullscreen ? '' : 'max-sm:pt-6'}`}
    >
      <div
        aria-hidden="true"
        ref={backdropRef}
        className={`absolute inset-0 touch-none ${backdropClassName}`}
        onClick={dismissOnBackdrop && open ? () => dismissRef.current?.() : undefined}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative flex max-h-full w-full flex-col overflow-y-auto overscroll-contain shadow-2xl outline-none ${panelClassName} max-sm:max-w-none max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[env(safe-area-inset-bottom)] ${isFullscreen ? FULLSCREEN_PANEL : ''}`}
      >
        {/* Grab bar: marks the sheet's drag strip (swipe down to dismiss when dismissible). */}
        {!isFullscreen && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1.5 left-1/2 z-20 hidden h-1 w-9 -translate-x-1/2 rounded-[2px] bg-slate-300 max-sm:block dark:bg-slate-600"
          />
        )}
        {children}
      </div>
    </dialog>
  );
}
