'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

const REACT_SCAN_STORAGE_KEY = 'zalobot-react-scan-enabled';

interface ReactScanContextValue {
  isReactScanEnabled: boolean;
  setReactScanEnabled: (enabled: boolean) => void;
}

const ReactScanContext = createContext<ReactScanContextValue | null>(null);

function getInitialReactScanEnabled(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      window.localStorage.getItem(REACT_SCAN_STORAGE_KEY) === 'true'
    );
  } catch {
    return false;
  }
}

// The profiler is loaded on demand, only after the user switches it on in Settings, so it never
// enters the bundle of a normal visit. Once loaded it stays in memory and is only toggled.
type ReactScanModule = Pick<typeof import('react-scan'), 'scan' | 'setOptions'>;
let reactScanModule: Promise<ReactScanModule> | null = null;

function loadReactScan(): Promise<ReactScanModule> {
  if (!reactScanModule) {
    reactScanModule = import('react-scan').then(({ scan, setOptions }) => ({ scan, setOptions }));
  }
  return reactScanModule;
}

export function ReactScanProvider({ children }: { children: ReactNode }) {
  const [isReactScanEnabled, setIsReactScanEnabled] = useState(false);

  useEffect(() => {
    setIsReactScanEnabled(getInitialReactScanEnabled());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Off and never loaded: nothing to do, and nothing to download.
    if (!isReactScanEnabled && !reactScanModule) return;
    let cancelled = false;
    void loadReactScan()
      .then((reactScan) => {
        if (cancelled) return;
        if (isReactScanEnabled) {
          reactScan.scan({ enabled: true, showToolbar: true });
        } else {
          reactScan.setOptions({ enabled: false, showToolbar: false });
        }
      })
      .catch(() => {
        // The profiler is a developer aid; the dashboard works the same without it.
      });
    return () => {
      cancelled = true;
    };
  }, [isReactScanEnabled]);

  const setReactScanEnabled = useCallback((enabled: boolean) => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(REACT_SCAN_STORAGE_KEY, String(enabled));
      }
    } catch {
      // Keep the preference only for this tab when storage is unavailable.
    }
    setIsReactScanEnabled(enabled);
  }, []);

  return (
    <ReactScanContext.Provider value={{ isReactScanEnabled, setReactScanEnabled }}>
      {children}
    </ReactScanContext.Provider>
  );
}

export function useReactScan() {
  const context = useContext(ReactScanContext);
  if (!context) {
    throw new Error('useReactScan must be used within ReactScanProvider');
  }
  return context;
}
