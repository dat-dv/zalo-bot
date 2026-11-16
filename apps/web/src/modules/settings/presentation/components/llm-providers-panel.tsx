'use client';

import { useState } from 'react';
import type { ILlmProviderPingResult, ILlmProviderStatus } from '@zalobot/contracts';
import { ConfigSwitch } from '@/modules/zca/presentation/components/thread-config/config-switch';
import { useLocale } from '@/shared/providers/locale-provider';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { DataPanel } from '@/shared/ui/data-table';
import { TAP_CONTROL } from '@/shared/ui/touch';
import {
  useDeleteLlmProviderMutation,
  useLlmProvidersQuery,
  usePingLlmProviderMutation,
  useReorderLlmProvidersMutation,
  useUpdateLlmProviderMutation,
} from '../../api/llm-providers-query';
import { LlmProviderDialog } from './llm-provider-dialog';

const STATUS_TONE = {
  ok: 'text-emerald-700 dark:text-emerald-300',
  warning: 'text-amber-700 dark:text-amber-300',
  danger: 'text-rose-700 dark:text-rose-300',
  muted: 'text-slate-500 dark:text-slate-400',
} as const;

const ROW_BUTTON = `inline-flex h-6 items-center justify-center rounded-[3px] border px-2 text-[11px] font-semibold ${BUTTON_TONE.secondary} ${TAP_CONTROL}`;
const ICON_BUTTON = `inline-flex size-6 items-center justify-center rounded-[3px] border text-[11px] ${BUTTON_TONE.secondary} ${TAP_CONTROL}`;

function pingResultView(
  result: ILlmProviderPingResult,
  t: ReturnType<typeof useLocale>['t'],
): { label: string; tone: string } {
  const ms = String(result.latencyMs ?? 0);
  switch (result.status) {
    case 'ok':
      return { label: t('settings.llm.status.ok', { ms }), tone: STATUS_TONE.ok };
    case 'empty':
      return { label: t('settings.llm.status.empty', { ms }), tone: STATUS_TONE.warning };
    case 'failed':
      return { label: t('settings.llm.status.failed', { ms }), tone: STATUS_TONE.danger };
    case 'not_configured':
      return { label: t('settings.llm.status.notConfigured'), tone: STATUS_TONE.muted };
  }
}

interface LlmProviderRowProps {
  provider: ILlmProviderStatus;
  isFirst: boolean;
  isLast: boolean;
  reordering: boolean;
  onMove: (direction: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
  onError: (message: string) => void;
}

function LlmProviderRow({
  provider,
  isFirst,
  isLast,
  reordering,
  onMove,
  onEdit,
  onDelete,
  onError,
}: LlmProviderRowProps) {
  const { t } = useLocale();
  const ping = usePingLlmProviderMutation();
  const toggle = useUpdateLlmProviderMutation();

  let outcome: { label: string; tone: string } | null = null;
  if (!provider.configured) {
    outcome = { label: t('settings.llm.status.notConfigured'), tone: STATUS_TONE.muted };
  } else if (ping.isError) {
    outcome = { label: t('settings.llm.pingRequestFailed'), tone: STATUS_TONE.danger };
  } else if (ping.data && !ping.isPending) {
    outcome = pingResultView(ping.data, t);
  }

  return (
    <li
      className={`flex items-center justify-between gap-3 py-2 max-[640px]:flex-wrap ${provider.enabled ? '' : 'opacity-60'}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex shrink-0 flex-col gap-0.5 max-[640px]:flex-row">
          <button
            type="button"
            className={ICON_BUTTON}
            disabled={isFirst || reordering}
            aria-label={t('settings.llm.moveUpAria', { name: provider.name })}
            onClick={() => onMove(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            className={ICON_BUTTON}
            disabled={isLast || reordering}
            aria-label={t('settings.llm.moveDownAria', { name: provider.name })}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <strong className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {provider.name}
            </strong>
            <span className="rounded-[2px] border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {provider.role ? t(`settings.llm.role.${provider.role}`) : t('settings.llm.disabled')}
            </span>
            <span className="text-[10.5px] text-slate-500 dark:text-slate-400">
              {t(`settings.llm.kind.${provider.kind}`)}
            </span>
          </div>
          <p className="mt-0.5 break-all text-[11.5px] text-slate-500 dark:text-slate-400">
            {provider.model || t('settings.llm.modelMissing')}
            {provider.baseUrl ? ` · ${provider.baseUrl}` : ''}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 max-[640px]:w-full max-[640px]:justify-between">
        <span className={`text-[11.5px] font-medium ${outcome?.tone ?? ''}`} role="status">
          {outcome?.label}
        </span>
        <div className="flex items-center gap-1.5">
          <ConfigSwitch
            size="sm"
            checked={provider.enabled}
            label={t('settings.llm.toggleAria', { name: provider.name })}
            onChange={(enabled) =>
              toggle.mutate(
                { id: provider.id, data: { enabled } },
                { onError: () => onError(t('settings.llm.error.save')) },
              )
            }
          />
          <button
            type="button"
            disabled={!provider.configured || ping.isPending}
            aria-label={t('settings.llm.pingAria', { name: provider.name })}
            onClick={() => ping.mutate(provider.id)}
            className={`${ROW_BUTTON} min-w-[64px]`}
          >
            {ping.isPending ? t('settings.llm.pinging') : t('settings.llm.ping')}
          </button>
          <button
            type="button"
            className={ROW_BUTTON}
            aria-label={t('settings.llm.editAria', { name: provider.name })}
            onClick={onEdit}
          >
            {t('settings.llm.editAction')}
          </button>
          <button
            type="button"
            className={`inline-flex h-6 items-center justify-center rounded-[3px] border px-2 text-[11px] font-semibold ${BUTTON_TONE.danger} ${TAP_CONTROL}`}
            aria-label={t('settings.llm.deleteAria', { name: provider.name })}
            onClick={onDelete}
          >
            {t('settings.llm.deleteAction')}
          </button>
        </div>
      </div>
    </li>
  );
}

type DialogState = { mode: 'create' } | { mode: 'edit'; provider: ILlmProviderStatus } | null;

/** Admin-only: the caller decides visibility, the API refuses everyone else. */
export function LlmProvidersPanel({ onToast }: { onToast: (message: string) => void }) {
  const { t } = useLocale();
  const providersQuery = useLlmProvidersQuery();
  const reorder = useReorderLlmProvidersMutation();
  const remove = useDeleteLlmProviderMutation();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [pendingDelete, setPendingDelete] = useState<ILlmProviderStatus | null>(null);
  const providers = providersQuery.data ?? [];
  const noneEnabled = providers.length > 0 && providers.every((provider) => !provider.enabled);

  const move = (index: number, direction: -1 | 1) => {
    const ids = providers.map((provider) => provider.id);
    const target = index + direction;
    const [moved] = ids.splice(index, 1);
    if (!moved || target < 0 || target > ids.length) return;
    ids.splice(target, 0, moved);
    reorder.mutate(ids, { onError: () => onToast(t('settings.llm.error.save')) });
  };

  return (
    <DataPanel
      title={t('settings.llm.title')}
      description={t('settings.llm.description')}
      toolbar={
        <button
          type="button"
          className={`inline-flex h-7 items-center justify-center rounded-[3px] border px-2.5 text-[11.5px] font-semibold ${BUTTON_TONE.primary} ${TAP_CONTROL}`}
          onClick={() => setDialog({ mode: 'create' })}
        >
          + {t('settings.llm.add')}
        </button>
      }
    >
      <div className="px-3 py-1">
        {providersQuery.isPending ? (
          <div className="flex flex-col gap-2 py-2" aria-hidden="true">
            <div className="h-8 animate-pulse rounded-[3px] bg-slate-100 dark:bg-slate-800" />
            <div className="h-8 animate-pulse rounded-[3px] bg-slate-100 dark:bg-slate-800" />
          </div>
        ) : providersQuery.isError ? (
          <div
            className="flex items-center justify-between gap-3 py-2 text-xs text-rose-700 dark:text-rose-300"
            role="alert"
          >
            <span>{t('dashboard.error.title')}</span>
            <button
              type="button"
              className={`rounded-[3px] border px-2 py-0.5 ${BUTTON_TONE.secondary} ${TAP_CONTROL}`}
              onClick={() => void providersQuery.refetch()}
            >
              {t('common.retry')}
            </button>
          </div>
        ) : providers.length === 0 ? (
          <p className="py-2 text-[11.5px] text-amber-700 dark:text-amber-300" role="alert">
            {t('settings.llm.empty')}
          </p>
        ) : (
          <>
            {noneEnabled && (
              <p className="pt-2 text-[11.5px] text-amber-700 dark:text-amber-300" role="alert">
                {t('settings.llm.noneEnabled')}
              </p>
            )}
            <ol className="divide-y divide-slate-200 dark:divide-slate-800">
              {providers.map((provider, index) => (
                <LlmProviderRow
                  key={provider.id}
                  provider={provider}
                  isFirst={index === 0}
                  isLast={index === providers.length - 1}
                  reordering={reorder.isPending}
                  onMove={(direction) => move(index, direction)}
                  onEdit={() => setDialog({ mode: 'edit', provider })}
                  onDelete={() => setPendingDelete(provider)}
                  onError={onToast}
                />
              ))}
            </ol>
          </>
        )}
      </div>

      {dialog && (
        <LlmProviderDialog
          provider={dialog.mode === 'edit' ? dialog.provider : undefined}
          onClose={() => setDialog(null)}
          onSaved={(message) => {
            setDialog(null);
            onToast(message);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('settings.llm.deleteTitle')}
        message={t('settings.llm.deleteConfirm', { name: pendingDelete?.name ?? '' })}
        confirmLabel={t('settings.llm.deleteAction')}
        pendingLabel={t('settings.llm.deleting')}
        isPending={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          remove.mutate(pendingDelete.id, {
            onSuccess: () => {
              setPendingDelete(null);
              onToast(t('settings.llm.toast.deleted'));
            },
            onError: () => {
              setPendingDelete(null);
              onToast(t('settings.llm.error.save'));
            },
          });
        }}
      />
    </DataPanel>
  );
}
