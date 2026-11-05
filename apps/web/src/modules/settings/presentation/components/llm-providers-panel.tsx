'use client';

import type { ILlmProviderPingResult, ILlmProviderStatus } from '@zalobot/contracts';
import { useLocale } from '@/shared/providers/locale-provider';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { DataPanel } from '@/shared/ui/data-table';
import { TAP_CONTROL } from '@/shared/ui/touch';
import { useLlmProvidersQuery, usePingLlmProviderMutation } from '../../api/llm-providers-query';

const STATUS_TONE = {
  ok: 'text-emerald-700 dark:text-emerald-300',
  warning: 'text-amber-700 dark:text-amber-300',
  danger: 'text-rose-700 dark:text-rose-300',
  muted: 'text-slate-500 dark:text-slate-400',
} as const;

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

function LlmProviderRow({ provider }: { provider: ILlmProviderStatus }) {
  const { t } = useLocale();
  const ping = usePingLlmProviderMutation();

  let outcome: { label: string; tone: string } | null = null;
  if (!provider.configured) {
    outcome = { label: t('settings.llm.status.notConfigured'), tone: STATUS_TONE.muted };
  } else if (ping.isError) {
    outcome = { label: t('settings.llm.pingRequestFailed'), tone: STATUS_TONE.danger };
  } else if (ping.data && !ping.isPending) {
    outcome = pingResultView(ping.data, t);
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2 max-[640px]:flex-wrap">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <strong className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            {provider.name}
          </strong>
          <span className="rounded-[2px] border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {t(`settings.llm.role.${provider.role}`)}
          </span>
        </div>
        <p className="mt-0.5 break-all text-[11.5px] text-slate-500 dark:text-slate-400">
          {provider.model ?? t('settings.llm.modelMissing')}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2.5 max-[640px]:w-full max-[640px]:justify-between">
        <span className={`text-[11.5px] font-medium ${outcome?.tone ?? ''}`} role="status">
          {outcome?.label}
        </span>
        <button
          type="button"
          disabled={!provider.configured || ping.isPending}
          aria-label={t('settings.llm.pingAria', { name: provider.name })}
          onClick={() => ping.mutate(provider.name)}
          className={`inline-flex h-6 min-w-[76px] items-center justify-center rounded-[3px] border px-2 text-[11px] font-semibold ${BUTTON_TONE.secondary} ${TAP_CONTROL}`}
        >
          {ping.isPending ? t('settings.llm.pinging') : t('settings.llm.ping')}
        </button>
      </div>
    </li>
  );
}

/** Admin-only: the caller decides visibility, the API refuses everyone else. */
export function LlmProvidersPanel() {
  const { t } = useLocale();
  const providersQuery = useLlmProvidersQuery();
  const providers = providersQuery.data ?? [];

  return (
    <DataPanel title={t('settings.llm.title')} description={t('settings.llm.description')}>
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
          <p className="py-2 text-[11.5px] text-slate-500 dark:text-slate-400">
            {t('settings.llm.empty')}
          </p>
        ) : (
          <ol className="divide-y divide-slate-200 dark:divide-slate-800">
            {providers.map((provider) => (
              <LlmProviderRow key={provider.name} provider={provider} />
            ))}
          </ol>
        )}
      </div>
    </DataPanel>
  );
}
