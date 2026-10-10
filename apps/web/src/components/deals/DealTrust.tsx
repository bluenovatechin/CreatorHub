/**
 * DEAL TRUST BOXES (shown inside DealWorkPanel, brand deals only):
 *   DisputeBox  "Report a problem" while the deal is running → the deal pauses and the Bluenova team steps in.
 *               Shows the open/resolved dispute; the other side's text is never shown.
 *   RatingBox   after completion, rate the other side once (1–5 stars, optional comment). Only the team sees ratings.
 * API: POST /deals/:id/dispute, POST /deals/:id/rating (apps/api/src/modules/deals/deals.routes.ts).
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Star } from 'lucide-react';
import { DISPUTE_REASONS } from '@bluenova/shared';
import { Alert, Button, Card, CardHeader, Dialog, Field, Select, Textarea, cx } from '@bluenova/ui';
import { api, errorText } from '../../lib/api';
import type { DealView } from '../../lib/types';

const DISPUTABLE = ['IN_PRODUCTION', 'DRAFT_SUBMITTED', 'BRAND_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'LIVE_SUBMITTED'];

function useDealUpdate(deal: DealView) {
  const qc = useQueryClient();
  return (d: DealView) => {
    qc.setQueryData(['deals', deal.id], d);
    void qc.invalidateQueries({ queryKey: ['deals'] });
  };
}

export function DisputeBox({ deal }: { deal: DealView }) {
  const { t } = useTranslation();
  const update = useDealUpdate(deal);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('QUALITY');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const raise = useMutation({
    mutationFn: () => api.post<DealView>(`/deals/${deal.id}/dispute`, { reason, description: description.trim() }),
    onMutate: () => setError(null),
    onSuccess: (d) => { update(d); setOpen(false); setDescription(''); },
    onError: (e) => setError(errorText(t, e)),
  });
  const d = deal.dispute;
  if (d?.status === 'OPEN') {
    return <Alert tone="amber" title={t('dispute.openTitle')}>{t(d.raisedByMe ? 'dispute.openMine' : 'dispute.openOther')}</Alert>;
  }
  return (
    <>
      {d?.resolution && (
        <Alert tone="blue" title={t(`dispute.resolved.${d.resolution.outcome}`)}>{d.resolution.note}</Alert>
      )}
      {DISPUTABLE.includes(deal.status) && (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-danger">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {t('dispute.button')}
        </button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={t('dispute.title')}
        footer={<>
          <Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={raise.isPending} disabled={description.trim().length < 20} onClick={() => raise.mutate()}>{t('dispute.send')}</Button>
        </>}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">{t('dispute.intro')}</p>
          <Field label={t('dispute.reason')}>
            {(id) => (
              <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
                {DISPUTE_REASONS.map((r) => <option key={r} value={r}>{t(`dispute.reasons.${r}`)}</option>)}
              </Select>
            )}
          </Field>
          <Field label={t('dispute.description')} hint={t('dispute.descriptionHint')}>
            {(id) => <Textarea id={id} rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          {error && <Alert tone="red">{error}</Alert>}
        </div>
      </Dialog>
    </>
  );
}

export function RatingBox({ deal, viewer }: { deal: DealView; viewer: 'creator' | 'brand' }) {
  const { t } = useTranslation();
  const update = useDealUpdate(deal);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rate = useMutation({
    mutationFn: () => api.post<DealView>(`/deals/${deal.id}/rating`, { stars, comment: comment.trim() || undefined }),
    onMutate: () => setError(null),
    onSuccess: update,
    onError: (e) => setError(errorText(t, e)),
  });
  if (deal.status !== 'COMPLETED') return null;
  if (deal.myRating) {
    return <p className="text-sm text-ink-muted">{t('rating.thanks', { stars: deal.myRating.stars })}</p>;
  }
  return (
    <Card>
      <CardHeader icon={<Star />} title={t(viewer === 'brand' ? 'rating.titleBrand' : 'rating.titleCreator')} subtitle={t('rating.private')} />
      <div className="flex gap-1" role="radiogroup" aria-label={t('rating.stars')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={String(n)} onClick={() => setStars(n)}
            className="rounded-lg p-1 hover:bg-sun-soft">
            <Star className={cx('h-7 w-7', n <= stars ? 'fill-sun text-sun' : 'text-line-strong')} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Field label={t('rating.comment')}>{(id) => <Textarea id={id} rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />}</Field>
      </div>
      {error && <div className="mt-3"><Alert tone="red">{error}</Alert></div>}
      <Button className="mt-4" loading={rate.isPending} disabled={stars === 0} onClick={() => rate.mutate()}>{t('rating.send')}</Button>
    </Card>
  );
}
