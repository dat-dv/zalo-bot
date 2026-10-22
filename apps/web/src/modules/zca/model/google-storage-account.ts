import axios from 'axios';
import type { IGoogleStorageAccountStatus, TranslationKey } from '@zalobot/contracts';

/** The storage account routes are admin-only: a 403 means "not an admin", not a failure. */
export function isForbiddenError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 403;
}

/** Sign-in button label: sign in when disconnected, re-grant when scopes are missing, else switch. */
export function storageLoginLabelKey(account: IGoogleStorageAccountStatus): TranslationKey {
  if (!account.connected) return 'zca.googleAccount.login';
  return account.hasStorageScopes ? 'zca.googleAccount.switch' : 'zca.googleAccount.regrant';
}

/** Uploads work only when connected with both Drive and Photos scopes. */
export function isStorageReady(account: IGoogleStorageAccountStatus): boolean {
  return account.connected && account.hasStorageScopes;
}
