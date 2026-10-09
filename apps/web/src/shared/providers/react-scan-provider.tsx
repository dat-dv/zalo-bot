'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

const REACT_SCAN_STORAGE_KEY = 'zalobot-react-scan-enabled';

interface ReactScanContextValue {
  isReactScanEnabled: boolean;
  setReactScanEnabled: (enabled: boolean) => void;
}

const ReactScanContext = createContext<ReactScanContextValue | null>(null);

function getInitialReactScanEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(REACT_SCAN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function ReactScanProvider({ children }: { children: ReactNode }) {
  const [isReactScanEnabled, setIsReactScanEnabled] = useState(false);

  useEffect(() => {
    setIsReactScanEnabled(getInitialReactScanEnabled());
  }, []);

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

