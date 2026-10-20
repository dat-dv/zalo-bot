'use client';

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'zalobot-theme';

interface ThemeState {
  theme: Theme;
  syncFromDocument: () => void;
  toggleTheme: () => void;
}

function getPreferredTheme(): Theme {
  // The inline script in app/layout.tsx already resolved the theme before hydration.
  const documentTheme = document.documentElement.dataset.theme;
  if (documentTheme === 'light' || documentTheme === 'dark') return documentTheme;
  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
  } catch {
    // The theme can still follow the system preference when storage is unavailable.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Starts as 'light' so the prerendered HTML and the first client render match;
// AppProviders calls syncFromDocument() after mount.
export const useThemeStore = create<ThemeState>()((set, get) => ({
  theme: 'light',
  syncFromDocument: () => {
    const preferredTheme = getPreferredTheme();
    document.documentElement.dataset.theme = preferredTheme;
    set({ theme: preferredTheme });
  },
  toggleTheme: () => {
    const nextTheme = get().theme === 'light' ? 'dark' : 'light';
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
    document.documentElement.dataset.theme = nextTheme;
    set({ theme: nextTheme });
  },
}));

export function useTheme() {
  return useThemeStore(
    useShallow((state) => ({ theme: state.theme, toggleTheme: state.toggleTheme })),
  );
}
