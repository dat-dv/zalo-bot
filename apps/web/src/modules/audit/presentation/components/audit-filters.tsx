'use client';

import {
  AUDIT_ACTIONS,
  AUDIT_SOURCE_FILTERS,
  AUDIT_TABLE_GROUPS,
  AUDIT_TABLES,
  isAuditAction,
  isAuditSourceFilter,
  isAuditTableName,
  type IAuditLogActorFacet,
} from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { MOBILE_TOOLBAR_ROW, PHONE_CHIP } from '@/shared/ui/touch';
import {
  AUDIT_ACTION_LABEL_KEYS,
  AUDIT_GROUP_LABEL_KEYS,
  AUDIT_SOURCE_LABEL_KEYS,
  AUDIT_TABLE_LABEL_KEYS,
  describeAuditActor,
} from '../../model/audit-labels';
import { hasActiveAuditFilters, type AuditFilterState } from '../../model/audit-url-state';

const CONTROL = `h-7 shrink-0 rounded-[3px] border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-sky-500 ${PHONE_CHIP}`;

interface AuditFiltersProps {
  state: AuditFilterState;
  actors: IAuditLogActorFacet[];
  onChange: (patch: Partial<Omit<AuditFilterState, 'page'>>) => void;
}

/** One filter per dimension; the URL and API also accept lists, the page sets at most one. */
export function AuditFilters({ state, actors, onChange }: AuditFiltersProps) {
  const { t } = useLocale();
  const actorLabel = (actor: IAuditLogActorFacet) =>
    describeAuditActor(
      {
        actorId: actor.id,
        actorName: actor.name,
        actorIsOwner: actor.isOwner,
        actorSource: null,
      },
      t,
    );

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${MOBILE_TOOLBAR_ROW}`}>
      <select
        className={CONTROL}
        aria-label={t('audit.filter.tables')}
        value={state.tables[0] ?? ''}
        onChange={(e) =>
          onChange({ tables: isAuditTableName(e.target.value) ? [e.target.value] : [] })
        }
      >
        <option value="">{t('audit.filter.allTables')}</option>
        {AUDIT_TABLE_GROUPS.map((group) => (
          <optgroup key={group} label={t(AUDIT_GROUP_LABEL_KEYS[group])}>
            {AUDIT_TABLES.filter((entry) => entry.group === group).map((entry) => (
              <option key={entry.table} value={entry.table}>
                {t(AUDIT_TABLE_LABEL_KEYS[entry.table])}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <select
        className={CONTROL}
        aria-label={t('audit.filter.actions')}
        value={state.actions[0] ?? ''}
        onChange={(e) =>
          onChange({ actions: isAuditAction(e.target.value) ? [e.target.value] : [] })
        }
      >
        <option value="">{t('audit.filter.allActions')}</option>
        {AUDIT_ACTIONS.map((action) => (
          <option key={action} value={action}>
            {t(AUDIT_ACTION_LABEL_KEYS[action])}
          </option>
        ))}
      </select>
      <select
        className={CONTROL}
        aria-label={t('audit.filter.sources')}
        value={state.sources[0] ?? ''}
        onChange={(e) =>
          onChange({ sources: isAuditSourceFilter(e.target.value) ? [e.target.value] : [] })
        }
      >
        <option value="">{t('audit.filter.allSources')}</option>
        {AUDIT_SOURCE_FILTERS.map((source) => (
          <option key={source} value={source}>
            {t(AUDIT_SOURCE_LABEL_KEYS[source])}
          </option>
        ))}
      </select>
      <select
        className={`${CONTROL} max-w-48`}
        aria-label={t('audit.filter.actors')}
        value={state.actorIds[0] ?? ''}
        onChange={(e) => onChange({ actorIds: e.target.value ? [e.target.value] : [] })}
      >
        <option value="">{t('audit.filter.allActors')}</option>
        {actors.map((actor) => (
          <option key={actor.id} value={actor.id}>
            {actorLabel(actor)}
          </option>
        ))}
      </select>
      <input
        type="date"
        className={CONTROL}
        aria-label={t('audit.filter.from')}
        title={t('audit.filter.from')}
        value={state.from}
        max={state.to || undefined}
        onChange={(e) => onChange({ from: e.target.value })}
      />
      <input
        type="date"
        className={CONTROL}
        aria-label={t('audit.filter.to')}
        title={t('audit.filter.to')}
        value={state.to}
        min={state.from || undefined}
        onChange={(e) => onChange({ to: e.target.value })}
      />
      <label
        className={`inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 ${PHONE_CHIP}`}
        title={t('audit.filter.technicalHint')}
      >
        <input
          type="checkbox"
          checked={state.technical}
          onChange={(e) => onChange({ technical: e.target.checked })}
        />
        {t('audit.filter.technical')}
      </label>
      {state.recordId && (
        <button
          type="button"
          className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-[3px] border border-sky-300 bg-sky-50 px-2 font-mono text-[11px] text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200 ${PHONE_CHIP}`}
          aria-label={t('audit.filter.clearRecord')}
          title={t('audit.filter.clearRecord')}
          onClick={() => onChange({ recordId: '' })}
        >
          {t('audit.filter.record', { id: `…${state.recordId.slice(-8)}` })}
          <span aria-hidden="true">✕</span>
        </button>
      )}
      {hasActiveAuditFilters(state) && (
        <button
          type="button"
          className={`h-7 shrink-0 rounded-[3px] px-2 text-xs font-medium text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-slate-800 ${PHONE_CHIP}`}
          onClick={() =>
            onChange({
              tables: [],
              actions: [],
              sources: [],
              actorIds: [],
              recordId: '',
              from: '',
              to: '',
              technical: false,
            })
          }
        >
          {t('audit.filter.clearAll')}
        </button>
      )}
    </div>
  );
}
