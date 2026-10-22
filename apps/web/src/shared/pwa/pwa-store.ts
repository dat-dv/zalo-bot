'use client';

import { create } from 'zustand';

/** Chromium's install prompt event; not in the TypeScript DOM lib yet. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return 'prompt' in event && typeof event.prompt === 'function';
}

interface PwaState {
  /** A new service worker is installed and waiting; reloading switches to it. */
  waitingWorker: ServiceWorker | null;
  /** Kept from `beforeinstallprompt` so Settings can open the install dialog later. */
  installPrompt: BeforeInstallPromptEvent | null;
  /** Set when the app is opened from the home screen or was just installed. */
  installed: boolean;
  setWaitingWorker: (worker: ServiceWorker | null) => void;
  setInstallPrompt: (event: BeforeInstallPromptEvent | null) => void;
  markInstalled: () => void;
}

export const usePwaStore = create<PwaState>()((set) => ({
  waitingWorker: null,
  installPrompt: null,
  installed: false,
  setWaitingWorker: (waitingWorker) => set({ waitingWorker }),
  setInstallPrompt: (installPrompt) => set({ installPrompt }),
  markInstalled: () => set({ installed: true, installPrompt: null }),
}));
