import {
  isAuditAction,
  isAuditSourceFilter,
  isAuditTableName,
  type AuditAction,
  type AuditSourceFilter,
  type AuditTableName,
  type IAuditLogListQuery,
} from '@zalobot/contracts';

/** Filters and page of /activity, mirrored in its query string. */
export interface AuditFilterState {
  tables: AuditTableName[];
  actions: AuditAction[];
  sources: AuditSourceFilter[];
  actorIds: string[];
  recordId: string;
  /** Local `YYYY-MM-DD`, inclusive; empty = open. */
  from: string;
  to: string;
  technical: boolean;
  page: number;
}

export const AUDIT_PAGE_SIZE = 50;

export const DEFAULT_AUDIT_FILTER_STATE: AuditFilterState = {
  tables: [],
  actions: [],
  sources: [],
  actorIds: [],
  recordId: '',
  from: '',
  to: '',
  technical: false,
  page: 1,
};

// `table` + `recordId` are also written by `APP_ROUTES.activityFor`.
const PARAM = {
  tables: 'table',
  actions: 'action',
  sources: 'source',
  actorIds: 'actor',
  recordId: 'recordId',
  from: 'from',
  to: 'to',
  technical: 'technical',
  page: 'page',
} as const;

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function unique<T extends string>(values: string[], isValid: (value: string) => value is T): T[] {
  return [...new Set(values.map((value) => value.trim()).filter(isValid))];
}

function localDate(value: string | null): string {
  return value && LOCAL_DATE.test(value) ? value : '';
}

function positiveInteger(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number >= 1 ? number : null;
}

/** Unknown or malformed values are dropped instead of failing. */
export function parseAuditFilterState(params: URLSearchParams): AuditFilterState {
  return {
    tables: unique(params.getAll(PARAM.tables), isAuditTableName),
    actions: unique(params.getAll(PARAM.actions), isAuditAction),
    sources: unique(params.getAll(PARAM.sources), isAuditSourceFilter),
    actorIds: unique(params.getAll(PARAM.actorIds), (value): value is string => value.length > 0),
    recordId: params.get(PARAM.recordId)?.trim() ?? '',
    from: localDate(params.get(PARAM.from)),
    to: localDate(params.get(PARAM.to)),
    technical: params.get(PARAM.technical) === '1',
    page: positiveInteger(params.get(PARAM.page)) ?? 1,
  };
}

/** Query string for the state, defaults omitted; empty string when nothing is set. */
export function toAuditFilterQuery(state: AuditFilterState): string {
  const params = new URLSearchParams();
  state.tables.forEach((table) => params.append(PARAM.tables, table));
  state.actions.forEach((action) => params.append(PARAM.actions, action));
  state.sources.forEach((source) => params.append(PARAM.sources, source));
  state.actorIds.forEach((actorId) => params.append(PARAM.actorIds, actorId));
  if (state.recordId.trim()) params.set(PARAM.recordId, state.recordId.trim());
  if (state.from) params.set(PARAM.from, state.from);
  if (state.to) params.set(PARAM.to, state.to);
  if (state.technical) params.set(PARAM.technical, '1');
  if (state.page > 1) params.set(PARAM.page, String(state.page));
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** Start (or end) of a local calendar day as an ISO instant. */
function localDayBound(value: string, end: boolean): string | undefined {
  const match = LOCAL_DATE.exec(value);
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const date = end
    ? new Date(year, month, day, 23, 59, 59, 999)
    : new Date(year, month, day, 0, 0, 0, 0);
  return date.toISOString();
}

export function toAuditListQuery(state: AuditFilterState): IAuditLogListQuery {
  return {
    tables: state.tables.length ? state.tables : undefined,
    actions: state.actions.length ? state.actions : undefined,
    sources: state.sources.length ? state.sources : undefined,
    actorIds: state.actorIds.length ? state.actorIds : undefined,
    recordId: state.recordId.trim() || undefined,
    startAt: localDayBound(state.from, false),
    endAt: localDayBound(state.to, true),
    includeTechnical: state.technical || undefined,
    limit: AUDIT_PAGE_SIZE,
    offset: (state.page - 1) * AUDIT_PAGE_SIZE,
  };
}

export function hasActiveAuditFilters(state: AuditFilterState): boolean {
  return toAuditFilterQuery({ ...state, page: 1 }) !== '';
}

/** Filters set inside the phone filter sheet; the record id has its own chip, so it is left out. */
export function countActiveAuditFilters(state: AuditFilterState): number {
  return [
    state.tables.length > 0,
    state.actions.length > 0,
    state.sources.length > 0,
    state.actorIds.length > 0,
    state.from !== '',
    state.to !== '',
    state.technical,
  ].filter(Boolean).length;
}
