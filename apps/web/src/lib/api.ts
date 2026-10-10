/**
 * WEBSITE → API connection. `api.get/post/put/patch('/path')` calls /api/v1/path with the login token
 * and automatically refreshes the session once if it expired. Also: errorText() turns API errors into
 * English/Gujarati text; applyServerErrors() puts per-field errors under the right form fields.
 */
import { ApiError, createApiClient } from '@bluenova/ui';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { TFunction } from 'i18next';

export interface Me {
  id: string;
  role: 'creator' | 'brand' | null;
  name: string | null;
  email: string;
  preferredLanguage: 'gu' | 'en';
  /** Also email important notifications (Settings). */
  emailNotifications?: boolean;
  creator?: { id: string; status: string; onboardingStep: number; isPartner: boolean; displayName: string | null; introReelDealId: string | null };
  brand?: { id: string; status: string; companyName: string | null };
}

let onSessionLost: () => void = () => undefined;
export const setSessionLostHandler = (fn: () => void) => {
  onSessionLost = fn;
};

export const api = createApiClient<Me>({
  refreshPath: '/auth/refresh',
  logoutPath: '/auth/logout',
  onSessionLost: () => onSessionLost(),
});

export { ApiError };

/** Human-readable text for any error. */
export function errorText(t: TFunction, err: unknown): string {
  if (err instanceof ApiError) {
    const key = err.message.startsWith('errors.') ? err.message : `errors.${err.code}`;
    return t(key, { defaultValue: t('errors.generic') });
  }
  return t('errors.generic');
}

/** Puts server-side field errors onto react-hook-form fields. Returns true if any were applied. */
export function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, prefix = ''): boolean {
  if (!(err instanceof ApiError) || !err.fields) return false;
  let applied = false;
  for (const [field, message] of Object.entries(err.fields)) {
    const name = field.startsWith(prefix) ? field.slice(prefix.length) : field;
    setError(name as Path<T>, { type: 'server', message });
    applied = true;
  }
  return applied;
}
