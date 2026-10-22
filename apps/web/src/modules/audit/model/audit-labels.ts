import {
  isAuditTableName,
  type AuditAction,
  type AuditSourceFilter,
  type AuditTableGroup,
  type AuditTableName,
  type IAuditLogDetail,
  type IAuditLogListItem,
  type TranslationKey,
} from '@zalobot/contracts';

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

export const AUDIT_TABLE_LABEL_KEYS: Record<AuditTableName, TranslationKey> = {
  finance_transactions: 'audit.table.finance_transactions',
  debts: 'audit.table.debts',
  debt_payments: 'audit.table.debt_payments',
  debt_payment_allocations: 'audit.table.debt_payment_allocations',
  debt_contacts: 'audit.table.debt_contacts',
  finance_places: 'audit.table.finance_places',
  user_categories: 'audit.table.user_categories',
  tasks: 'audit.table.tasks',
  task_reminder_times: 'audit.table.task_reminder_times',
  calendar_events: 'audit.table.calendar_events',
  reminders: 'audit.table.reminders',
  reminder_times: 'audit.table.reminder_times',
  users: 'audit.table.users',
  zca_thread_configs: 'audit.table.zca_thread_configs',
  channel_storage_links: 'audit.table.channel_storage_links',
  user_tokens: 'audit.table.user_tokens',
  dashboard_exchange_tokens: 'audit.table.dashboard_exchange_tokens',
};

export const AUDIT_ACTION_LABEL_KEYS: Record<AuditAction, TranslationKey> = {
  insert: 'audit.action.insert',
  update: 'audit.action.update',
  remove: 'audit.action.remove',
};

export const AUDIT_SOURCE_LABEL_KEYS: Record<AuditSourceFilter, TranslationKey> = {
  dashboard: 'audit.source.dashboard',
  zalo: 'audit.source.zalo',
  system: 'audit.source.system',
  legacy: 'audit.source.legacy',
};

export const AUDIT_GROUP_LABEL_KEYS: Record<AuditTableGroup, TranslationKey> = {
  finance: 'audit.group.finance',
  planning: 'audit.group.planning',
  system: 'audit.group.system',
};

/** Tables outside `AUDIT_TABLES` keep their raw name. */
export function describeAuditTable(tableName: string, t: Translate): string {
  return isAuditTableName(tableName) ? t(AUDIT_TABLE_LABEL_KEYS[tableName]) : tableName;
}

type ActorFields = Pick<
  IAuditLogListItem,
  'actorId' | 'actorName' | 'actorIsOwner' | 'actorSource'
>;

export function describeAuditActor(item: ActorFields, t: Translate): string {
  if (item.actorName) return item.actorName;
  if (item.actorIsOwner) return t('session.owner');
  if (item.actorId) return t('audit.actor.unnamed', { suffix: item.actorId.slice(-4) });
  return item.actorSource === 'system' ? t('audit.actor.system') : t('audit.actor.unknown');
}

/** Source of the row, `legacy` for rows written before the source was recorded. */
export function auditSourceOf(item: Pick<IAuditLogListItem, 'actorSource'>): AuditSourceFilter {
  return item.actorSource ?? 'legacy';
}

/** Zalo chat the change came from, empty when it did not come from Zalo. */
export function describeAuditChannel(
  item: Pick<IAuditLogListItem, 'channelId' | 'channelName' | 'channelType'>,
  t: Translate,
): string {
  if (!item.channelId) return '';
  if (item.channelType === 'group') {
    return item.channelName
      ? t('audit.channel.group', { name: item.channelName })
      : t('audit.channel.groupUnnamed');
  }
  return t('audit.channel.direct');
}

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export interface AuditDiffRow {
  field: string;
  before: string;
  after: string;
  changed: boolean;
}

/** Field-by-field view of a change, changed fields first, then the rest in stored order. */
export function buildAuditDiffRows(
  detail: Pick<IAuditLogDetail, 'beforeData' | 'afterData' | 'changedFields'>,
): AuditDiffRow[] {
  const before = detail.beforeData ?? {};
  const after = detail.afterData ?? {};
  const fields = [...new Set([...Object.keys(after), ...Object.keys(before)])];
  const changed = new Set(detail.changedFields);
  const rows = fields.map((field): AuditDiffRow => ({
    field,
    before: field in before ? formatAuditValue(before[field]) : '—',
    after: field in after ? formatAuditValue(after[field]) : '—',
    changed: changed.has(field),
  }));
  return [...rows.filter((row) => row.changed), ...rows.filter((row) => !row.changed)];
}
