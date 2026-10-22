'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { APP_ROUTES } from '@zalobot/contracts';
import {
  parseChatTableState,
  toChatTableQuery,
  type ChatTableState,
} from '../model/chat-table-url-state';

// Remembers the table query for the "back" link on the thread config page; per-tab only.
const RETURN_QUERY_KEY = 'zca:chat-table-query';

/**
 * Table state lives in React and is mirrored into the /zca query string, so leaving for the
 * thread config page and coming back (browser back or the page's back link) restores it.
 * `history.replaceState` keeps the URL in sync without a navigation per keystroke.
 */
export function useChatTableUrlState() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<ChatTableState>(() => parseChatTableState(searchParams));

  useEffect(() => {
    const query = toChatTableQuery(state);
    window.history.replaceState(window.history.state, '', `${APP_ROUTES.zca}${query}`);
    try {
      window.sessionStorage.setItem(RETURN_QUERY_KEY, query);
    } catch {
      // Storage can be unavailable (private mode); the back link then opens the default table.
    }
  }, [state]);

  /** Changing what is listed starts again from page 1. */
  const update = (patch: Partial<Omit<ChatTableState, 'page'>>) =>
    setState((current) => ({ ...current, ...patch, page: 1 }));
  const setPage = (page: number) => setState((current) => ({ ...current, page }));

  return { state, update, setPage };
}

/** Link back to the /zca table with the search, filter and page the user left it on. */
export function readChatTableReturnHref(): string {
  try {
    return `${APP_ROUTES.zca}${window.sessionStorage.getItem(RETURN_QUERY_KEY) ?? ''}`;
  } catch {
    return APP_ROUTES.zca;
  }
}
