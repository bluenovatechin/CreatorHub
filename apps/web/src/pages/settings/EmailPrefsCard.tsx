/**
 * SETTINGS → EMAIL NOTIFICATIONS: one switch for "also email me about important updates" (offers, reviews,
 * deadlines, team messages). Login codes and password emails are always sent.
 * API: PATCH /me/preferences { emailNotifications } (apps/api/src/modules/auth/auth.routes.ts).
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import { Alert, Button, Card, CardHeader } from '@bluenova/ui';
import { api, errorText } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export function EmailPrefsCard() {
  const { t } = useTranslation();
  const { me, reloadMe } = useAuth();
  const [saved, setSaved] = useState(false);
  const on = me?.emailNotifications !== false;
  const save = useMutation({
    mutationFn: (value: boolean) => api.patch('/me/preferences', { emailNotifications: value }),
    onMutate: () => setSaved(false),
    onSuccess: async () => { await reloadMe(); setSaved(true); },
  });
  return (
    <Card>
      <CardHeader icon={<Mail />} title={t('settings.emailTitle')} subtitle={t('settings.emailText')} />
      <Button variant={on ? 'accent' : 'secondary'} aria-pressed={on} loading={save.isPending} onClick={() => save.mutate(!on)}>
        {on ? t('settings.emailOn') : t('settings.emailOff')}
      </Button>
      {saved && <p className="mt-2 text-sm text-ink-muted">{t('settings.saved')}</p>}
      {save.error && <div className="mt-3"><Alert tone="red">{errorText(t, save.error)}</Alert></div>}
    </Card>
  );
}
