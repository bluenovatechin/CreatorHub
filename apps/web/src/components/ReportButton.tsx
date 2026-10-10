/**
 * "REPORT" LINK + DIALOG: a creator reports a campaign, or a brand reports a creator, to the Bluenova team.
 * Used on the creator's offer page (campaign) and the brand's deal page (creator).
 * API: POST /reports (apps/api/src/modules/trust/reports.routes.ts). The team reviews every report.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Flag } from 'lucide-react';
import { REPORT_REASONS } from '@bluenova/shared';
import { Alert, Button, Dialog, Field, Select, Textarea } from '@bluenova/ui';
import { api, errorText } from '../lib/api';

export function ReportButton({ targetType, targetId }: { targetType: 'CAMPAIGN' | 'CREATOR'; targetId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('FAKE');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const send = useMutation({
    mutationFn: () => api.post('/reports', { targetType, targetId, reason, details: details.trim() }),
    onMutate: () => setError(null),
    onSuccess: () => { setSent(true); setOpen(false); setDetails(''); },
    onError: (e) => setError(errorText(t, e)),
  });
  if (sent) return <p className="text-sm text-ink-muted">{t('report.sent')}</p>;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-danger">
        <Flag className="h-4 w-4" aria-hidden="true" /> {t(targetType === 'CAMPAIGN' ? 'report.campaign' : 'report.creator')}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t(targetType === 'CAMPAIGN' ? 'report.campaign' : 'report.creator')}
        footer={<>
          <Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={send.isPending} disabled={details.trim().length < 10} onClick={() => send.mutate()}>{t('report.send')}</Button>
        </>}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">{t('report.intro')}</p>
          <Field label={t('report.reason')}>
            {(id) => (
              <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
                {REPORT_REASONS.map((r) => <option key={r} value={r}>{t(`report.reasons.${r}`)}</option>)}
              </Select>
            )}
          </Field>
          <Field label={t('report.details')}>{(id) => <Textarea id={id} rows={4} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />}</Field>
          {error && <Alert tone="red">{error}</Alert>}
        </div>
      </Dialog>
    </>
  );
}
