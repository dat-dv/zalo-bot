'use client';

import { Fragment, useId, type ReactNode } from 'react';
import {
  CONTACT_PROFILE_LIMITS,
  CONTACT_RELATIONSHIPS,
  isContactRelationship,
  localeTag,
  type ContactProfileUpdateError,
  type ContactProfileUpdateErrorCode,
  type ContactRelationship,
  type IContactProfile,
  type TranslationKey,
} from '@zalobot/contracts';
import { DataPanel } from '@/shared/ui/data-table';
import { useLocale } from '@/shared/providers/locale-provider';
import {
  profileErrorValues,
  type ContactProfileForm,
  type ContactProfileFormErrors,
} from '../../../model/contact-profile-form';
import {
  FIELD_ERROR,
  FIELD_LABEL,
  GHOST_BUTTON,
  MUTED,
  PRIMARY_BUTTON,
  PROFILE_INPUT,
  PROFILE_TEXTAREA,
  SECONDARY_BUTTON,
} from './profile-styles';

interface ProfileInfoPanelProps {
  contact: IContactProfile;
  form: ContactProfileForm | null;
  errors: ContactProfileFormErrors;
  saveError: string | null;
  isSaving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onChange: (next: ContactProfileForm) => void;
}

const RELATIONSHIP_LABEL: Record<ContactRelationship, TranslationKey> = {
  family: 'contacts.profile.relationship.family',
  friend: 'contacts.profile.relationship.friend',
  colleague: 'contacts.profile.relationship.colleague',
  partner: 'contacts.profile.relationship.partner',
  other: 'contacts.profile.relationship.other',
};

const ERROR_MESSAGE: Record<ContactProfileUpdateErrorCode, TranslationKey> = {
  text_too_long: 'contacts.profile.errors.text_too_long',
  notes_too_long: 'contacts.profile.errors.notes_too_long',
  birthday_invalid: 'contacts.profile.errors.birthday_invalid',
  birthday_future: 'contacts.profile.errors.birthday_future',
  relationship_invalid: 'contacts.profile.errors.relationship_invalid',
  list_invalid: 'contacts.profile.errors.list_invalid',
  too_many_items: 'contacts.profile.errors.too_many_items',
  label_too_long: 'contacts.profile.errors.label_too_long',
  phone_invalid: 'contacts.profile.errors.phone_invalid',
  bank_account_invalid: 'contacts.profile.errors.bank_account_invalid',
};

const EMPTY = <span className="text-slate-400 select-none dark:text-slate-600">—</span>;

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2 border-b border-slate-100 px-3 py-1.5 last:border-b-0 dark:border-slate-800">
      <dt className={FIELD_LABEL}>{label}</dt>
      <dd className="m-0 min-w-0 text-xs text-slate-800 dark:text-slate-200">{children}</dd>
    </div>
  );
}

function EditRow({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 px-3 py-2 last:border-b-0 dark:border-slate-800">
      <label className={FIELD_LABEL} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && <p className={FIELD_ERROR}>{error}</p>}
    </div>
  );
}

/** One line per value, primary first, with a muted label after a middle dot. */
function ValueList({ items }: { items: { key: string; value: string; note?: string }[] }) {
  if (items.length === 0) return EMPTY;
  return (
    <ul className="m-0 list-none p-0">
      {items.map((item) => (
        <li className="truncate" key={item.key} title={item.value}>
          <span className="font-mono text-[11.5px]">{item.value}</span>
          {item.note && (
            <>
              <span className={`px-1 ${MUTED}`}>·</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{item.note}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ProfileInfoPanel({
  contact,
  form,
  errors,
  saveError,
  isSaving,
  onEdit,
  onCancel,
  onSave,
  onChange,
}: ProfileInfoPanelProps) {
  const { t, locale } = useLocale();
  const idPrefix = useId();
  const fieldId = (name: string) => `${idPrefix}-${name}`;
  const errorText = (error?: ContactProfileUpdateError) =>
    error ? t(ERROR_MESSAGE[error.code], profileErrorValues(error)) : undefined;
  const relationshipLabel = (value: ContactRelationship) => t(RELATIONSHIP_LABEL[value]);

  const toolbar = form ? (
    <>
      <button className={PRIMARY_BUTTON} disabled={isSaving} onClick={onSave} type="button">
        {isSaving ? t('common.saving') : t('contacts.profile.save')}
      </button>
      <button className={SECONDARY_BUTTON} disabled={isSaving} onClick={onCancel} type="button">
        {t('contacts.profile.cancel')}
      </button>
    </>
  ) : (
    <button className={SECONDARY_BUTTON} onClick={onEdit} type="button">
      {t('contacts.profile.edit')}
    </button>
  );

  if (!form) {
    const phones = [
      ...(contact.phoneNumber
        ? [{ key: 'primary', value: contact.phoneNumber, note: t('contacts.profile.primary') }]
        : []),
      ...contact.extraPhones.map((phone, index) => ({
        key: `extra-${index}`,
        value: phone.value,
        note: phone.label,
      })),
    ];
    const accounts = [
      ...(contact.bankAccountNumber
        ? [
            {
              key: 'primary',
              value: contact.bankAccountNumber,
              note: [contact.bankName, t('contacts.profile.primary')].filter(Boolean).join(' · '),
            },
          ]
        : []),
      ...contact.extraBankAccounts.map((account, index) => ({
        key: `extra-${index}`,
        value: account.accountNumber,
        note: [account.bankName, account.label].filter(Boolean).join(' · ') || undefined,
      })),
    ];
    const birthday = contact.birthday
      ? new Intl.DateTimeFormat(localeTag(locale), { dateStyle: 'medium', timeZone: 'UTC' }).format(
          new Date(`${contact.birthday}T00:00:00Z`),
        )
      : null;

    return (
      <DataPanel title={t('contacts.profile.section.info')} toolbar={toolbar}>
        <dl className="m-0">
          <InfoRow label={t('contacts.profile.field.phones')}>
            <ValueList items={phones} />
          </InfoRow>
          <InfoRow label={t('contacts.profile.field.bankAccounts')}>
            <ValueList items={accounts} />
          </InfoRow>
          <InfoRow label={t('contacts.profile.field.birthday')}>{birthday ?? EMPTY}</InfoRow>
          <InfoRow label={t('contacts.profile.field.relationship')}>
            {contact.relationship ? relationshipLabel(contact.relationship) : EMPTY}
          </InfoRow>
          <InfoRow label={t('contacts.profile.field.address')}>{contact.address ?? EMPTY}</InfoRow>
          <InfoRow label={t('contacts.profile.field.workplace')}>
            {contact.workplace ?? EMPTY}
          </InfoRow>
          <InfoRow label={t('contacts.profile.field.notes')}>
            {contact.notes ? (
              <p className="m-0 whitespace-pre-line break-words">{contact.notes}</p>
            ) : (
              EMPTY
            )}
          </InfoRow>
        </dl>
      </DataPanel>
    );
  }

  const set = <K extends keyof ContactProfileForm>(key: K, value: ContactProfileForm[K]) =>
    onChange({ ...form, [key]: value });
  const rowError = (error: ContactProfileUpdateError | undefined, index: number) =>
    error?.index === index ? errorText(error) : undefined;
  const listError = (error: ContactProfileUpdateError | undefined) =>
    error && error.index === undefined ? errorText(error) : undefined;
  const canAdd = (count: number) => count < CONTACT_PROFILE_LIMITS.MAX_EXTRA_ITEMS;

  return (
    <DataPanel title={t('contacts.profile.section.info')} toolbar={toolbar}>
      {saveError && (
        <p
          className="m-0 border-b border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
          role="alert"
        >
          {saveError}
        </p>
      )}
      <div>
        <EditRow
          error={errors.displayName ? t('contacts.profile.errors.nameRequired') : undefined}
          htmlFor={fieldId('name')}
          label={t('contacts.profile.field.name')}
        >
          <input
            aria-invalid={Boolean(errors.displayName)}
            className={PROFILE_INPUT}
            id={fieldId('name')}
            onChange={(e) => set('displayName', e.target.value)}
            value={form.displayName}
          />
        </EditRow>
        <div className="grid grid-cols-2">
          <EditRow htmlFor={fieldId('alias')} label={t('contacts.profile.field.alias')}>
            <input
              className={PROFILE_INPUT}
              id={fieldId('alias')}
              onChange={(e) => set('alias', e.target.value)}
              value={form.alias}
            />
          </EditRow>
          <EditRow htmlFor={fieldId('descriptor')} label={t('contacts.profile.field.descriptor')}>
            <input
              className={PROFILE_INPUT}
              id={fieldId('descriptor')}
              onChange={(e) => set('descriptor', e.target.value)}
              value={form.descriptor}
            />
          </EditRow>
        </div>

        <EditRow error={listError(errors.extraPhones)} label={t('contacts.profile.field.phones')}>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto] items-center gap-1">
            <input
              aria-label={`${t('contacts.profile.field.phones')} · ${t('contacts.profile.primary')}`}
              className={PROFILE_INPUT}
              onChange={(e) => set('phoneNumber', e.target.value)}
              placeholder={t('contacts.profile.placeholder.phone')}
              value={form.phoneNumber}
            />
            <span className="px-1 text-[11px] text-slate-500 dark:text-slate-400">
              {t('contacts.profile.primary')}
            </span>
            <span />
            {form.extraPhones.map((row, index) => (
              <Fragment key={index}>
                <input
                  aria-invalid={errors.extraPhones?.index === index}
                  aria-label={t('contacts.profile.placeholder.phone')}
                  className={PROFILE_INPUT}
                  onChange={(e) =>
                    set(
                      'extraPhones',
                      form.extraPhones.map((item, i) =>
                        i === index ? { ...item, value: e.target.value } : item,
                      ),
                    )
                  }
                  placeholder={t('contacts.profile.placeholder.phone')}
                  value={row.value}
                />
                <input
                  aria-label={t('contacts.profile.placeholder.label')}
                  className={PROFILE_INPUT}
                  onChange={(e) =>
                    set(
                      'extraPhones',
                      form.extraPhones.map((item, i) =>
                        i === index ? { ...item, label: e.target.value } : item,
                      ),
                    )
                  }
                  placeholder={t('contacts.profile.placeholder.label')}
                  value={row.label}
                />
                <button
                  aria-label={t('contacts.profile.removeRow')}
                  className={SECONDARY_BUTTON}
                  onClick={() =>
                    set(
                      'extraPhones',
                      form.extraPhones.filter((_, i) => i !== index),
                    )
                  }
                  title={t('contacts.profile.removeRow')}
                  type="button"
                >
                  ✕
                </button>
                {rowError(errors.extraPhones, index) && (
                  <p className={`${FIELD_ERROR} col-span-3`}>
                    {rowError(errors.extraPhones, index)}
                  </p>
                )}
              </Fragment>
            ))}
          </div>
          {canAdd(form.extraPhones.length) && (
            <button
              className={`${GHOST_BUTTON} w-fit`}
              onClick={() => set('extraPhones', [...form.extraPhones, { value: '', label: '' }])}
              type="button"
            >
              {t('contacts.profile.addPhone')}
            </button>
          )}
        </EditRow>

        <EditRow
          error={listError(errors.extraBankAccounts)}
          label={t('contacts.profile.field.bankAccounts')}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto] items-center gap-1">
            <input
              aria-label={`${t('contacts.profile.field.bankAccounts')} · ${t('contacts.profile.primary')}`}
              className={PROFILE_INPUT}
              onChange={(e) => set('bankAccountNumber', e.target.value)}
              placeholder={t('contacts.profile.placeholder.accountNumber')}
              value={form.bankAccountNumber}
            />
            <input
              aria-label={t('contacts.profile.placeholder.bankName')}
              className={PROFILE_INPUT}
              onChange={(e) => set('bankName', e.target.value)}
              placeholder={t('contacts.profile.placeholder.bankName')}
              value={form.bankName}
            />
            <span className="px-1 text-[11px] text-slate-500 dark:text-slate-400">
              {t('contacts.profile.primary')}
            </span>
            <span />
            {form.extraBankAccounts.map((row, index) => (
              <Fragment key={index}>
                <input
                  aria-invalid={errors.extraBankAccounts?.index === index}
                  aria-label={t('contacts.profile.placeholder.accountNumber')}
                  className={PROFILE_INPUT}
                  onChange={(e) =>
                    set(
                      'extraBankAccounts',
                      form.extraBankAccounts.map((item, i) =>
                        i === index ? { ...item, accountNumber: e.target.value } : item,
                      ),
                    )
                  }
                  placeholder={t('contacts.profile.placeholder.accountNumber')}
                  value={row.accountNumber}
                />
                <input
                  aria-label={t('contacts.profile.placeholder.bankName')}
                  className={PROFILE_INPUT}
                  onChange={(e) =>
                    set(
                      'extraBankAccounts',
                      form.extraBankAccounts.map((item, i) =>
                        i === index ? { ...item, bankName: e.target.value } : item,
                      ),
                    )
                  }
                  placeholder={t('contacts.profile.placeholder.bankName')}
                  value={row.bankName}
                />
                <input
                  aria-label={t('contacts.profile.placeholder.label')}
                  className={PROFILE_INPUT}
                  onChange={(e) =>
                    set(
                      'extraBankAccounts',
                      form.extraBankAccounts.map((item, i) =>
                        i === index ? { ...item, label: e.target.value } : item,
                      ),
                    )
                  }
                  placeholder={t('contacts.profile.placeholder.label')}
                  value={row.label}
                />
                <button
                  aria-label={t('contacts.profile.removeRow')}
                  className={SECONDARY_BUTTON}
                  onClick={() =>
                    set(
                      'extraBankAccounts',
                      form.extraBankAccounts.filter((_, i) => i !== index),
                    )
                  }
                  title={t('contacts.profile.removeRow')}
                  type="button"
                >
                  ✕
                </button>
                {rowError(errors.extraBankAccounts, index) && (
                  <p className={`${FIELD_ERROR} col-span-4`}>
                    {rowError(errors.extraBankAccounts, index)}
                  </p>
                )}
              </Fragment>
            ))}
          </div>
          {canAdd(form.extraBankAccounts.length) && (
            <button
              className={`${GHOST_BUTTON} w-fit`}
              onClick={() =>
                set('extraBankAccounts', [
                  ...form.extraBankAccounts,
                  { accountNumber: '', bankName: '', label: '' },
                ])
              }
              type="button"
            >
              {t('contacts.profile.addBankAccount')}
            </button>
          )}
          <p className={`m-0 text-[11px] ${MUTED}`}>{t('contacts.profile.primaryHint')}</p>
        </EditRow>

        <div className="grid grid-cols-2">
          <EditRow
            error={errorText(errors.birthday)}
            htmlFor={fieldId('birthday')}
            label={t('contacts.profile.field.birthday')}
          >
            <input
              aria-invalid={Boolean(errors.birthday)}
              className={PROFILE_INPUT}
              id={fieldId('birthday')}
              onChange={(e) => set('birthday', e.target.value)}
              type="date"
              value={form.birthday}
            />
          </EditRow>
          <EditRow
            error={errorText(errors.relationship)}
            htmlFor={fieldId('relationship')}
            label={t('contacts.profile.field.relationship')}
          >
            <select
              className={PROFILE_INPUT}
              id={fieldId('relationship')}
              onChange={(e) =>
                set('relationship', isContactRelationship(e.target.value) ? e.target.value : '')
              }
              value={form.relationship}
            >
              <option value="">{t('contacts.profile.relationship.none')}</option>
              {CONTACT_RELATIONSHIPS.map((value) => (
                <option key={value} value={value}>
                  {relationshipLabel(value)}
                </option>
              ))}
            </select>
          </EditRow>
        </div>
        <EditRow
          error={errorText(errors.address)}
          htmlFor={fieldId('address')}
          label={t('contacts.profile.field.address')}
        >
          <input
            aria-invalid={Boolean(errors.address)}
            className={PROFILE_INPUT}
            id={fieldId('address')}
            onChange={(e) => set('address', e.target.value)}
            placeholder={t('contacts.profile.placeholder.address')}
            value={form.address}
          />
        </EditRow>
        <EditRow
          error={errorText(errors.workplace)}
          htmlFor={fieldId('workplace')}
          label={t('contacts.profile.field.workplace')}
        >
          <input
            aria-invalid={Boolean(errors.workplace)}
            className={PROFILE_INPUT}
            id={fieldId('workplace')}
            onChange={(e) => set('workplace', e.target.value)}
            placeholder={t('contacts.profile.placeholder.workplace')}
            value={form.workplace}
          />
        </EditRow>
        <EditRow
          error={errorText(errors.notes)}
          htmlFor={fieldId('notes')}
          label={t('contacts.profile.field.notes')}
        >
          <textarea
            aria-invalid={Boolean(errors.notes)}
            className={PROFILE_TEXTAREA}
            id={fieldId('notes')}
            maxLength={CONTACT_PROFILE_LIMITS.NOTES_MAX_LENGTH}
            onChange={(e) => set('notes', e.target.value)}
            placeholder={t('contacts.profile.placeholder.notes')}
            value={form.notes}
          />
        </EditRow>
      </div>
    </DataPanel>
  );
}
