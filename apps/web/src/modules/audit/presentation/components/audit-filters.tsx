'use client';

import { useId, useState, type ReactNode } from 'react';
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
import { useIsPhone } from '@/shared/hooks/use-media-query';
import { useLocale } from '@/shared/providers/locale-provider';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import {
  MODAL_CLOSE_TAP,
  MODAL_FOOTER_TAP,
  MODAL_STICKY_FOOTER,
  MODAL_STICKY_HEADER,
  Modal,
} from '@/shared/ui/modal';
import { MOBILE_TOOLBAR_ROW, PHONE_CHIP, TAP_INPUT } from '@/shared/ui/touch';
import {
  AUDIT_ACTION_LABEL_KEYS,
  AUDIT_GROUP_LABEL_KEYS,
  AUDIT_SOURCE_LABEL_KEYS,
  AUDIT_TABLE_LABEL_KEYS,
  describeAuditActor,
} from '../../model/audit-labels';
import {
  countActiveAuditFilters,
  hasActiveAuditFilters,
  type AuditFilterState,
} from '../../model/audit-url-state';

type AuditFilterPatch = Partial<Omit<AuditFilterState, 'page'>>;

const CONTROL_LOOK =
  'rounded-[3px] border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-sky-500';

/** Desktop: one compact row. Sheet: full-width fields with visible labels, 40px on phones. */
const CONTROL = {
  row: `h-7 shrink-0 ${CONTROL_LOOK} ${PHONE_CHIP}`,
  stack: `h-8 w-full min-w-0 ${CONTROL_LOOK} max-[640px]:text-sm ${TAP_INPUT}`,
} as const;

const CLEARED: AuditFilterPatch = {
  tables: [],
  actions: [],
  sources: [],
  actorIds: [],
  recordId: '',
  from: '',
  to: '',
  technical: false,
};

interface AuditFiltersProps {
  state: AuditFilterState;
  actors: IAuditLogActorFacet[];
  onChange: (patch: AuditFilterPatch) => void;
}

/**
 * One filter per dimension; the URL and API also accept lists, the page sets at most one.
 * Phones get a single "Filters" chip opening a sheet, because seven controls in one row
 * scroll far past the screen.
 */
export function AuditFilters({ state, actors, onChange }: AuditFiltersProps) {
  const { t } = useLocale();
  const isPhone = useIsPhone();
  const [sheetOpen, setSheetOpen] = useState(false);
  const titleId = useId();
  const sheetCount = countActiveAuditFilters(state);

  const recordChip = state.recordId && (
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
  );
  const clearAll = hasActiveAuditFilters(state) && (
    <button
      type="button"
      className={`h-7 shrink-0 rounded-[3px] px-2 text-xs font-medium ${BUTTON_TONE.accent} ${PHONE_CHIP}`}
      onClick={() => onChange(CLEARED)}
    >
      {t('audit.filter.clearAll')}
    </button>
  );

  if (!isPhone) {
    return (
      <div className={`flex flex-wrap items-center gap-1.5 ${MOBILE_TOOLBAR_ROW}`}>
        <AuditFilterFields layout="row" state={state} actors={actors} onChange={onChange} />
        {recordChip}
        {clearAll}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 ${MOBILE_TOOLBAR_ROW}`}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        onClick={() => setSheetOpen(true)}
        className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[3px] border px-2 text-xs font-medium ${
          sheetCount > 0 ? BUTTON_TONE.chipSelected : BUTTON_TONE.chip
        } ${PHONE_CHIP}`}
      >
        <svg viewBox="0 0 16 16" className="size-3" fill="currentColor" aria-hidden="true">
          <path d="M1.5 2.5h13l-5 6v4.25l-3 1.75v-6z" />
        </svg>
        {sheetCount > 0
          ? t('audit.filter.openCount', { count: sheetCount })
          : t('audit.filter.open')}
      </button>
      {recordChip}
      {clearAll}

      <Modal
        open={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
        dismissOnBackdrop
        labelledBy={titleId}
        backdropClassName="bg-black/50"
        panelClassName="rounded-t-[4px] border-t border-slate-300 bg-white px-4 dark:border-slate-700 dark:bg-slate-900"
      >
        <div
          className={`${MODAL_STICKY_HEADER} flex items-center justify-between bg-white pt-4 pb-2 dark:bg-slate-900`}
        >
          <h3 id={titleId} className="text-base font-bold text-slate-900 dark:text-slate-100">
            {t('audit.filter.sheetTitle')}
          </h3>
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            aria-label={t('common.close')}
            className={`rounded-[3px] p-1 ${BUTTON_TONE.ghost} ${MODAL_CLOSE_TAP}`}
          >
            ✕
          </button>
        </div>
        {/* Changes apply at once, like the desktop row; the sheet only gathers the controls. */}
        <div className="flex flex-col gap-3">
          <AuditFilterFields layout="stack" state={state} actors={actors} onChange={onChange} />
        </div>
        <div
          className={`${MODAL_STICKY_FOOTER} mt-4 flex gap-2 bg-white pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:bg-slate-900`}
        >
          {sheetCount > 0 && (
            <button
              type="button"
              onClick={() => onChange(CLEARED)}
              className={`rounded-[3px] border px-3 py-1.5 text-sm font-medium ${BUTTON_TONE.secondary} ${MODAL_FOOTER_TAP}`}
            >
              {t('audit.filter.clearAll')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className={`rounded-[3px] px-3 py-1.5 text-sm font-semibold ${BUTTON_TONE.primary} ${MODAL_FOOTER_TAP}`}
          >
            {t('audit.filter.done')}
          </button>
        </div>
      </Modal>
    </div>
  );
}

interface AuditFilterFieldsProps {
  layout: keyof typeof CONTROL;
  state: AuditFilterState;
  actors: IAuditLogActorFacet[];
  onChange: (patch: AuditFilterPatch) => void;
}

function AuditFilterFields({ layout, state, actors, onChange }: AuditFilterFieldsProps) {
  const { t } = useLocale();
  const control = CONTROL[layout];
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
  // The row relies on aria-labels and the first option; the sheet shows a label above each field.
  const field = (label: string, input: ReactNode) =>
    layout === 'stack' ? (
      <label className="flex min-w-0 flex-col gap-1 text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
        {label}
        {input}
      </label>
    ) : (
      input
    );

  const dates = (
    <>
      {field(
        t('audit.filter.from'),
        <input
          type="date"
          className={control}
          aria-label={t('audit.filter.from')}
          title={t('audit.filter.from')}
          value={state.from}
          max={state.to || undefined}
          onChange={(e) => onChange({ from: e.target.value })}
        />,
      )}
      {field(
        t('audit.filter.to'),
        <input
          type="date"
          className={control}
          aria-label={t('audit.filter.to')}
          title={t('audit.filter.to')}
          value={state.to}
          min={state.from || undefined}
          onChange={(e) => onChange({ to: e.target.value })}
        />,
      )}
    </>
  );

  return (
    <>
      {field(
        t('audit.filter.tables'),
        <select
          className={control}
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
        </select>,
      )}
      {field(
        t('audit.filter.actions'),
        <select
          className={control}
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
        </select>,
      )}
      {field(
        t('audit.filter.sources'),
        <select
          className={control}
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
        </select>,
      )}
      {field(
        t('audit.filter.actors'),
        <select
          className={layout === 'row' ? `${control} max-w-48` : control}
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
        </select>,
      )}
      {layout === 'stack' ? <div className="grid grid-cols-2 gap-2">{dates}</div> : dates}
      <label
        className={
          layout === 'row'
            ? `inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 ${PHONE_CHIP}`
            : 'flex min-h-10 cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200'
        }
        title={t('audit.filter.technicalHint')}
      >
        <input
          type="checkbox"
          className={layout === 'stack' ? 'size-4' : undefined}
          checked={state.technical}
          onChange={(e) => onChange({ technical: e.target.checked })}
        />
        {t('audit.filter.technical')}
      </label>
      {layout === 'stack' && (
        <p className="-mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">
          {t('audit.filter.technicalHint')}
        </p>
      )}
    </>
  );
}
