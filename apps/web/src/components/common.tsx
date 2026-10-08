import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Loading } from '@bluenova/ui';
import { errorText } from '../lib/api';
import { statusTone } from '../lib/format';

/** Translates a validation message key (e.g. "errors.phone") for display under a field. */
export function useFieldError() {
  const { t } = useTranslation();
  return (message: string | undefined) => (message ? t(message, { defaultValue: t('errors.zod.custom') }) : undefined);
}

export function StatusBadge({ kind, status }: { kind: 'creator' | 'campaign' | 'offer' | 'deal'; status: string }) {
  const { t } = useTranslation();
  return <Badge tone={statusTone(status)}>{t(`status.${kind}.${status}`)}</Badge>;
}

export function QueryState({ isLoading, error, retry }: { isLoading: boolean; error: unknown; retry?: () => void }) {
  const { t } = useTranslation();
  if (isLoading) return <Loading label={t('common.loading')} />;
  if (error) {
    return (
      <Alert tone="red" title={errorText(t, error)}>
        {retry && <Button variant="secondary" size="sm" className="mt-2" onClick={retry}>{t('common.retry')}</Button>}
      </Alert>
    );
  }
  return null;
}

export function SafetyTip({ kind = 'payment' }: { kind?: 'payment' | 'otp' }) {
  const { t } = useTranslation();
  return <p className="flex items-start gap-2 rounded-ctl bg-primary-soft p-3 text-sm text-navy"><span aria-hidden="true">🔒</span>{t(`safety.${kind}`)}</p>;
}
