/**
 * APPLY TO A CAMPAIGN (dialog on /creator/opportunities): a short pitch and, optionally, the creator's price.
 * The Bluenova team reviews it and either adds the creator to the brand's shortlist or declines.
 * API: POST /opportunities/:id/apply (apps/api/src/modules/creators/creators.routes.ts).
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Dialog, Field, Input, Textarea } from '@bluenova/ui';
import { api, errorText } from '../../../lib/api';
import type { Opportunity } from '../../../lib/types';

export function ApplyDialog({ opportunity, onClose }: { opportunity: Opportunity | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [pitch, setPitch] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const apply = useMutation({
    mutationFn: () => api.post(`/opportunities/${opportunity!.id}/apply`, { pitch: pitch.trim(), proposedRate: rate ? Number(rate) : undefined }),
    onMutate: () => setError(null),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['opportunities'] });
      void qc.invalidateQueries({ queryKey: ['applications'] });
      setPitch('');
      setRate('');
      onClose();
    },
    onError: (e) => setError(errorText(t, e)),
  });
  const short = pitch.trim().length < 20;
  return (
    <Dialog open={!!opportunity} onClose={onClose} title={t('apply.title', { campaign: opportunity?.title ?? '' })}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
        <Button loading={apply.isPending} disabled={short} onClick={() => apply.mutate()}>{t('apply.send')}</Button>
      </>}>
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">{t('apply.intro')}</p>
        <Field label={t('apply.pitch')} hint={t('apply.pitchHint')}>
          {(id) => <Textarea id={id} rows={5} maxLength={1000} autoFocus value={pitch} onChange={(e) => setPitch(e.target.value)} />}
        </Field>
        <Field label={t('apply.rate')} hint={t('apply.rateHint')}>
          {(id) => <Input id={id} inputMode="numeric" placeholder="₹" value={rate} onChange={(e) => setRate(e.target.value.replace(/\D/g, '').slice(0, 8))} />}
        </Field>
        {error && <Alert tone="red">{error}</Alert>}
      </div>
    </Dialog>
  );
}
