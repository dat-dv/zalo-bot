'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { APP_ROUTES } from '@zalobot/contracts';
import {
  parseAuditFilterState,
  toAuditFilterQuery,
  type AuditFilterState,
} from '../model/audit-url-state';

/**
 * Filters live in React and are mirrored into the /activity query string, so a filtered view can
 * be shared or reopened. `history.replaceState` avoids a navigation per change.
 */
export function useAuditFilterUrlState() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<AuditFilterState>(() => parseAuditFilterState(searchParams));

  useEffect(() => {
    window.history.replaceState(
      window.history.state,
      '',
      `${APP_ROUTES.activity}${toAuditFilterQuery(state)}`,
    );
  }, [state]);

  /** Changing what is listed starts again from page 1. */
  const update = (patch: Partial<Omit<AuditFilterState, 'page'>>) =>
    setState((current) => ({ ...current, ...patch, page: 1 }));
  const setPage = (page: number) => setState((current) => ({ ...current, page }));

  return { state, update, setPage };
}
