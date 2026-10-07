'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

const REACT_SCAN_STORAGE_KEY = 'zalobot-react-scan-enabled';

interface ReactScanContextValue {
  isReactScanEnabled: boolean;
  setReactScanEnabled: (enabled: boolean) => void;
}

type ReactScanModule = Pick<typeof import('react-scan'), 'scan' | 'setOptions'>;

const ReactScanContext = createContext<ReactScanContextValue | null>(null);

function getInitialReactScanEnabled(): boolean {
  try {
    return window.localStorage.getItem(REACT_SCAN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function ReactScanProvider({ children }: { children: ReactNode }) {
  const [isReactScanEnabled, setIsReactScanEnabled] = useState(false);
  const reactScanModuleRef = useRef<ReactScanModule | null>(null);

  useEffect(() => {
    setIsReactScanEnabled(getInitialReactScanEnabled());
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!isReactScanEnabled) {
      reactScanModuleRef.current?.setOptions({ enabled: false, showToolbar: false });
      return () => {
        cancelled = true;
      };
    }

    const options = {
      enabled: true,
      showToolbar: true,
      dangerouslyForceRunInProduction: true,
    };

    if (reactScanModuleRef.current) {
      reactScanModuleRef.current.setOptions(options);
    } else {
      void import('react-scan')
        .then((module) => {
          if (cancelled) return;
          reactScanModuleRef.current = module;
          module.scan(options);
        })
        .catch(() => {
          if (!cancelled) setIsReactScanEnabled(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [isReactScanEnabled]);

  const setReactScanEnabled = useCallback((enabled: boolean) => {
    try {
      window.localStorage.setItem(REACT_SCAN_STORAGE_KEY, String(enabled));
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
