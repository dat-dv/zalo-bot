'use client';

import { useState } from 'react';
import {
  LLM_PROVIDER_DEFAULT_BASE_URLS,
  LLM_PROVIDER_KINDS,
  LLM_PROVIDER_MODEL_MAX_LENGTH,
  LLM_PROVIDER_NAME_MAX_LENGTH,
  isLlmProviderKind,
  type ILlmProviderStatus,
  type LlmProviderKind,
} from '@zalobot/contracts';
import { apiErrorText } from '@/modules/zca/model/channel-memory';
import { useLocale } from '@/shared/providers/locale-provider';
import {
  FORM_ERROR_TEXT,
  FORM_FIELD,
  FORM_HINT,
  FORM_LABEL,
  FormDialog,
} from '@/shared/ui/form-dialog';
import {
  useCreateLlmProviderMutation,
  useUpdateLlmProviderMutation,
} from '../../api/llm-providers-query';

interface LlmProviderDialogProps {
  /** The provider being edited; none to add one. */
  provider?: ILlmProviderStatus;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const CHECKBOX_ROW = 'flex items-center gap-2 text-[12.5px] text-slate-700 dark:text-slate-200';

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Add or edit one AI of the chain. The stored API key is never shown, only replaced or removed. */
export function LlmProviderDialog({ provider, onClose, onSaved }: LlmProviderDialogProps) {
  const { t } = useLocale();
  const [name, setName] = useState(provider?.name ?? '');
  const [kind, setKind] = useState<LlmProviderKind>(provider?.kind ?? 'openai');
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? '');
  const [model, setModel] = useState(provider?.model ?? '');
  const [apiKey, setApiKey] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const createMutation = useCreateLlmProviderMutation();
  const updateMutation = useUpdateLlmProviderMutation();
  const mutation = provider ? updateMutation : createMutation;

  const defaultBaseUrl = LLM_PROVIDER_DEFAULT_BASE_URLS[kind];
  const trimmedBaseUrl = baseUrl.trim();
  const baseUrlInvalid = kind !== 'gemini' && trimmedBaseUrl !== '' && !isHttpUrl(trimmedBaseUrl);
  const keyStored = Boolean(provider?.hasApiKey) && !clearApiKey;

  const handleSubmit = () => {
    const common = {
      name: name.trim(),
      kind,
      baseUrl: kind === 'gemini' ? null : trimmedBaseUrl || null,
      model: model.trim(),
      enabled,
    };
    const typedKey = apiKey.trim();
    if (provider) {
      updateMutation.mutate(
        {
          id: provider.id,
          data: {
            ...common,
            ...(typedKey ? { apiKey: typedKey } : {}),
            ...(!typedKey && clearApiKey ? { clearApiKey: true } : {}),
          },
        },
        { onSuccess: () => onSaved(t('settings.llm.toast.updated')) },
      );
      return;
    }
    createMutation.mutate(
      { ...common, apiKey: typedKey || null },
      { onSuccess: () => onSaved(t('settings.llm.toast.created')) },
    );
  };

  return (
    <FormDialog
      open
      title={
        provider
          ? t('settings.llm.form.editTitle', { name: provider.name })
          : t('settings.llm.form.createTitle')
      }
      description={t('settings.llm.form.description')}
      submitLabel={t('settings.llm.form.save')}
      submitDisabled={!name.trim() || !model.trim() || baseUrlInvalid}
      isPending={mutation.isPending}
      errorMessage={
        mutation.error ? apiErrorText(mutation.error, t('settings.llm.error.save')) : null
      }
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      <label className="grid gap-1">
        <span className={FORM_LABEL}>{t('settings.llm.form.name')}</span>
        <input
          className={FORM_FIELD}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('settings.llm.form.namePlaceholder')}
          maxLength={LLM_PROVIDER_NAME_MAX_LENGTH}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          required
        />
      </label>

      <label className="grid gap-1">
        <span className={FORM_LABEL}>{t('settings.llm.form.kind')}</span>
        <select
          className={FORM_FIELD}
          value={kind}
          onChange={(e) => {
            if (isLlmProviderKind(e.target.value)) setKind(e.target.value);
          }}
        >
          {LLM_PROVIDER_KINDS.map((option) => (
            <option key={option} value={option}>
              {t(`settings.llm.kind.${option}`)}
            </option>
          ))}
        </select>
      </label>

      {kind !== 'gemini' && (
        <label className="grid gap-1">
          <span className={FORM_LABEL}>{t('settings.llm.form.baseUrl')}</span>
          <input
            className={FORM_FIELD}
            type="url"
            inputMode="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={defaultBaseUrl ?? ''}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={baseUrlInvalid}
          />
          {baseUrlInvalid ? (
            <span className={FORM_ERROR_TEXT}>{t('settings.llm.form.error.baseUrlInvalid')}</span>
          ) : (
            defaultBaseUrl && (
              <span className={FORM_HINT}>
                {t('settings.llm.form.baseUrlDefault', { url: defaultBaseUrl })}
              </span>
            )
          )}
        </label>
      )}

      <label className="grid gap-1">
        <span className={FORM_LABEL}>{t('settings.llm.form.model')}</span>
        <input
          className={FORM_FIELD}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          maxLength={LLM_PROVIDER_MODEL_MAX_LENGTH}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
      </label>

      <label className="grid gap-1">
        <span className={FORM_LABEL}>{t('settings.llm.form.apiKey')}</span>
        <input
          className={FORM_FIELD}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={
            keyStored ? t('settings.llm.form.apiKeyKeep') : t('settings.llm.form.apiKeyOptional')
          }
          autoComplete="new-password"
          spellCheck={false}
        />
      </label>

      {provider?.hasApiKey && (
        <label className={CHECKBOX_ROW}>
          <input
            type="checkbox"
            checked={clearApiKey}
            disabled={apiKey.trim() !== ''}
            onChange={(e) => setClearApiKey(e.target.checked)}
          />
          {t('settings.llm.form.clearApiKey')}
        </label>
      )}

      <label className={CHECKBOX_ROW}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        {t('settings.llm.form.enabled')}
      </label>
    </FormDialog>
  );
}
