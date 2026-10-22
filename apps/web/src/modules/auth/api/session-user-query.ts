'use client';

import { useQuery } from '@tanstack/react-query';
import type { IDashboardSessionUser } from '@zalobot/contracts';
import { getSessionUser } from './session-user-api';

export const sessionQueryKeys = {
  me: () => ['session', 'me'] as const,
};

// Sign-in and sign-out clear the whole query cache, so a cached session never outlives its user.
const SESSION_USER_STALE_TIME_MS = 5 * 60_000;

/** Who the dashboard session belongs to; disabled until a session token exists. */
export function useSessionUserQuery(options: { enabled: boolean }) {
  return useQuery<IDashboardSessionUser>({
    queryKey: sessionQueryKeys.me(),
    queryFn: ({ signal }) => getSessionUser(signal),
    staleTime: SESSION_USER_STALE_TIME_MS,
    enabled: options.enabled,
  });
}
