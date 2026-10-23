import { BadRequestException } from '@nestjs/common';
import {
  AUDIT_LOG_DEFAULT_LIMIT,
  AUDIT_LOG_MAX_LIMIT,
  isAuditAction,
  isAuditSourceFilter,
  isAuditTableName,
  type IAuditLogListQuery,
} from '@zalobot/contracts';

const MAX_LIST_VALUES = 50;
// Touched by every save, so it never tells what was edited.
const BOOKKEEPING_FIELDS = new Set(['updatedAt']);

/** Parses `GET /api/audit-logs` query params; lists arrive as repeated keys. */
export function parseAuditLogListQuery(query: Record<string, unknown>): IAuditLogListQuery {
  const startAt = isoDate(query.startAt, 'startAt');
  const endAt = isoDate(query.endAt, 'endAt');
  if (startAt && endAt && startAt > endAt)
    throw new BadRequestException('startAt must be before endAt.');
  return {
    tables: list(query.tables, 'tables', isAuditTableName),
    actions: list(query.actions, 'actions', isAuditAction),
    sources: list(query.sources, 'sources', isAuditSourceFilter),
    actorIds: list(query.actorIds, 'actorIds', (value): value is string => value.length > 0),
    recordId: text(query.recordId),
    startAt,
    endAt,
    includeTechnical: query.includeTechnical === 'true' || query.includeTechnical === true,
    limit: Math.min(
      integer(query.limit, 'limit', 1) ?? AUDIT_LOG_DEFAULT_LIMIT,
      AUDIT_LOG_MAX_LIMIT,
    ),
    offset: integer(query.offset, 'offset', 0) ?? 0,
  };
}

function list<T extends string>(
  value: unknown,
  name: string,
  isValid: (item: string) => item is T,
): T[] | undefined {
  if (value === undefined || value === '') return undefined;
  const raw = Array.isArray(value) ? value : [value];
  if (!raw.every((item): item is string => typeof item === 'string'))
    throw new BadRequestException(`${name} must be a list of strings.`);
  const items = [...new Set(raw.map((item) => item.trim()).filter(Boolean))];
  if (items.length > MAX_LIST_VALUES)
    throw new BadRequestException(`${name} accepts at most ${MAX_LIST_VALUES} values.`);
  const invalid = items.find((item) => !isValid(item));
  if (invalid !== undefined) throw new BadRequestException(`${name} has an unknown value.`);
  return items.length ? items.filter(isValid) : undefined;
}

function isoDate(value: unknown, name: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  const time = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(time)) throw new BadRequestException(`${name} must be an ISO date.`);
  return new Date(time).toISOString();
}

function integer(value: unknown, name: string, min: number): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < min)
    throw new BadRequestException(`${name} must be an integer >= ${min}.`);
  return parsed;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Fields an audit row touched. An update with a before copy lists the values that differ; a
 * bulk update (`repo.update`) has no before copy, so every written field counts. Inserts and
 * removals show the whole row in the detail view instead.
 */
export function computeChangedFields(
  action: string,
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): string[] {
  if (action !== 'update' || !after) return [];
  const keys = Object.keys(after).filter((key) => !BOOKKEEPING_FIELDS.has(key));
  if (!before) return keys;
  return keys.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}
