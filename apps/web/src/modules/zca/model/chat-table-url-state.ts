import type { ChatRowFilter, ChatRowSort } from './chat-rows';

/** Search, filter, sort and paging of the /zca table, mirrored in its query string. */
export interface ChatTableState {
  search: string;
  filter: ChatRowFilter;
  sortBy: ChatRowSort;
  page: number;
  pageSize: number;
}

export const CHAT_TABLE_PAGE_SIZES = [15, 25, 50, 100, 10000] as const;

export const DEFAULT_CHAT_TABLE_STATE: ChatTableState = {
  search: '',
  filter: 'all',
  sortBy: 'listened_first',
  page: 1,
  pageSize: 25,
};

const FILTERS: readonly ChatRowFilter[] = [
  'all',
  'listened',
  'group',
  'personal',
  'pending',
  'granted',
  'admin',
];
const SORTS: readonly ChatRowSort[] = [
  'listened_first',
  'pending_first',
  'name_asc',
  'name_desc',
  'group_first',
  'user_first',
  'members_desc',
];

const PARAM = { search: 'q', filter: 'filter', sortBy: 'sort', page: 'page', pageSize: 'size' };

function pickOne<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.find((item) => item === value) ?? fallback;
}

function positiveInteger(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= 1 ? number : null;
}

/** Unknown or malformed values fall back to the defaults instead of failing. */
export function parseChatTableState(params: URLSearchParams): ChatTableState {
  const pageSize = positiveInteger(params.get(PARAM.pageSize));
  return {
    search: params.get(PARAM.search) ?? DEFAULT_CHAT_TABLE_STATE.search,
    filter: pickOne(params.get(PARAM.filter), FILTERS, DEFAULT_CHAT_TABLE_STATE.filter),
    sortBy: pickOne(params.get(PARAM.sortBy), SORTS, DEFAULT_CHAT_TABLE_STATE.sortBy),
    page: positiveInteger(params.get(PARAM.page)) ?? DEFAULT_CHAT_TABLE_STATE.page,
    pageSize:
      CHAT_TABLE_PAGE_SIZES.find((size) => size === pageSize) ?? DEFAULT_CHAT_TABLE_STATE.pageSize,
  };
}

/** Query string for the state, with defaults omitted; empty string when everything is default. */
export function toChatTableQuery(state: ChatTableState): string {
  const params = new URLSearchParams();
  const search = state.search.trim();
  if (search) params.set(PARAM.search, search);
  if (state.filter !== DEFAULT_CHAT_TABLE_STATE.filter) params.set(PARAM.filter, state.filter);
  if (state.sortBy !== DEFAULT_CHAT_TABLE_STATE.sortBy) params.set(PARAM.sortBy, state.sortBy);
  if (state.page !== DEFAULT_CHAT_TABLE_STATE.page) params.set(PARAM.page, String(state.page));
  if (state.pageSize !== DEFAULT_CHAT_TABLE_STATE.pageSize) {
    params.set(PARAM.pageSize, String(state.pageSize));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
