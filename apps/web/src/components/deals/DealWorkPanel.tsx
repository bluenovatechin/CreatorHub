/**
 * DEAL WORK PANEL: the "work" part of a deal, shared by the creator deal page, the intro reel page and the brand
 * deal page. Shows what happens next, the history of draft/live links with their reviews, and the one action
 * the signed-in person can take right now:
 *   creator  send a draft link (IN_PRODUCTION, REVISION_REQUESTED) or the live Instagram link (APPROVED)
 *   brand    approve the draft the team forwarded, or ask for changes (BRAND_REVIEW; limited number of changes)
 * API: POST /deals/:id/draft, /deals/:id/live, /deals/:id/review (apps/api/src/modules/deals/deals.routes.ts).
 * Links are opened with <ExternalLink>, which only allows https. Brand deals also get the dispute and rating boxes
 * (DealTrust.tsx) and a link to message the Bluenova team about this deal.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Clapperboard, FileVideo, History as History_, MessageSquareText, MessagesSquare, Send } from 'lucide-react';
import { Alert, Button, Card, CardHeader, ExternalLink, Field, Input, Textarea, cx } from '@bluenova/ui';
import { api, errorText } from '../../lib/api';
import { formatDate, formatINR } from '../../lib/format';
import type { DealView, WorkSubmission } from '../../lib/types';
import { DisputeBox, RatingBox } from './DealTrust';

const CAN_SEND_DRAFT = ['IN_PRODUCTION', 'REVISION_REQUESTED'];

function SendWorkForm({ deal, kind }: { deal: DealView; kind: 'draft' | 'live' }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () => api.post<DealView>(`/deals/${deal.id}/${kind}`, { url: url.trim(), note: note.trim() || undefined }),
    onMutate: () => setError(null),
    onSuccess: (d) => {
      qc.setQueryData(['deals', deal.id], d);
      void qc.invalidateQueries({ queryKey: ['deals'] });
      setUrl('');
      setNote('');
    },
    onError: (e) => setError(errorText(t, e)),
  });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); send.mutate(); }} noValidate>
      <Field label={t(kind === 'draft' ? 'work.draftUrl' : 'work.liveUrl')} hint={t(kind === 'draft' ? 'work.draftHint' : 'work.liveHint')}>
        {(id) => <Input id={id} type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />}
      </Field>
      <Field label={t('work.note')}>{(id) => <Textarea id={id} rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
      {error && <Alert tone="red">{error}</Alert>}
      <Button type="submit" loading={send.isPending} disabled={!url.trim()}>
        <Send className="h-4 w-4" aria-hidden="true" /> {t(kind === 'draft' ? 'work.sendDraft' : 'work.sendLive')}
      </Button>
    </form>
  );
}

function BrandReview({ deal }: { deal: DealView }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const review = useMutation({
    mutationFn: (decision: 'APPROVE' | 'REVISION') => api.post<DealView>(`/deals/${deal.id}/review`, { decision, note: note.trim() || undefined }),
    onMutate: () => setError(null),
    onSuccess: (d) => {
      qc.setQueryData(['deals', deal.id], d);
      void qc.invalidateQueries({ queryKey: ['deals'] });
      setAsking(false);
      setNote('');
    },
    onError: (e) => setError(errorText(t, e)),
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">{t('work.revisionsLeft', { count: deal.revisionsLeft })}</p>
      {deal.brandReviewDueAt && (
        <p className="text-sm text-ink-muted">{t('work.autoApproveBy', { date: formatDate(deal.brandReviewDueAt, i18n.language) })}</p>
      )}
      {asking ? (
        <>
          <Field label={t('work.changesNote')}>{(id) => <Textarea id={id} rows={3} maxLength={1000} autoFocus value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
          <div className="flex flex-wrap gap-2">
            <Button loading={review.isPending} disabled={note.trim().length < 3} onClick={() => review.mutate('REVISION')}>{t('work.sendChanges')}</Button>
            <Button variant="secondary" onClick={() => setAsking(false)}>{t('common.cancel')}</Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button loading={review.isPending} onClick={() => review.mutate('APPROVE')}>{t('work.approve')}</Button>
          <Button variant="secondary" disabled={deal.revisionsLeft <= 0} onClick={() => setAsking(true)}>{t('work.askChanges')}</Button>
        </div>
      )}
      {error && <Alert tone="red">{error}</Alert>}
    </div>
  );
}

/** Changes the Bluenova team recorded to the agreed terms (who changed what, when and why). */
function Amendments({ items }: { items: DealView['amendments'] }) {
  const { t, i18n } = useTranslation();
  if (!items?.length) return null;
  const show = (field: string, v: unknown) =>
    v == null ? '—' : field.endsWith('Paise') ? formatINR(Number(v)) : field.endsWith('Due') ? formatDate(String(v), i18n.language) : String(v);
  return (
    <Card>
      <CardHeader icon={<History_ />} title={t('work.amendmentsTitle')} />
      <ul className="space-y-3 text-sm">
        {items.map((a, i) => (
          <li key={i} className="rounded-xl bg-bg p-3">
            <p className="text-xs text-ink-muted">{formatDate(a.at, i18n.language)}{a.reason ? ` · ${a.reason}` : ''}</p>
            {Object.entries(a.changes).map(([field, c]) => (
              <p key={field}><b>{t(`work.amendmentFields.${field}`)}</b>: {show(field, c.from)} → {show(field, c.to)}</p>
            ))}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function History({ items }: { items: WorkSubmission[] }) {
  const { t, i18n } = useTranslation();
  if (items.length === 0) return <p className="text-sm text-ink-muted">{t('work.none')}</p>;
  return (
    <ol className="space-y-4">
      {[...items].reverse().map((s) => (
        <li key={s.id} className="rounded-2xl border border-line p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-navy">
            {s.kind === 'DRAFT' ? <FileVideo className="h-4 w-4 text-primary" aria-hidden="true" /> : <Clapperboard className="h-4 w-4 text-accent" aria-hidden="true" />}
            {t(s.kind === 'DRAFT' ? 'work.draft' : 'work.live')}
            <span className="font-normal text-ink-muted">· {formatDate(s.submittedAt, i18n.language)}</span>
          </p>
          <p className="mt-1 break-all text-sm"><ExternalLink href={s.url}>{s.url}</ExternalLink></p>
          {s.note && <p className="mt-2 whitespace-pre-line text-sm">{s.note}</p>}
          {s.reviews.map((r, i) => (
            <div key={i} className={cx('mt-3 rounded-xl p-3 text-sm', ['APPROVE', 'VERIFY'].includes(r.decision) ? 'bg-success-soft' : 'bg-warning-soft')}>
              <p className="flex items-center gap-1.5 font-semibold">
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                {t(`work.by.${r.by}`)}: {t(`work.decision.${r.decision}`)}
              </p>
              {r.note && <p className="mt-1 whitespace-pre-line">{r.note}</p>}
            </div>
          ))}
        </li>
      ))}
    </ol>
  );
}

export function DealWorkPanel({ deal, viewer }: { deal: DealView; viewer: 'creator' | 'brand' }) {
  const { t } = useTranslation();
  const action = viewer === 'creator'
    ? CAN_SEND_DRAFT.includes(deal.status) ? <SendWorkForm deal={deal} kind="draft" /> : deal.status === 'APPROVED' ? <SendWorkForm deal={deal} kind="live" /> : null
    : deal.status === 'BRAND_REVIEW' ? <BrandReview deal={deal} /> : null;
  return (
    <>
      <Alert tone={deal.status === 'COMPLETED' ? 'green' : action ? 'amber' : 'blue'}>
        {t(`work.next.${viewer}.${deal.status}`, { defaultValue: t('work.next.default') })}
      </Alert>
      {deal.type === 'BRAND' && <DisputeBox deal={deal} />}
      {deal.type === 'BRAND' && <RatingBox deal={deal} viewer={viewer} />}
      {action && deal.status !== 'DISPUTED' && <Card><CardHeader icon={<Send />} title={t('work.yourTurn')} />{action}</Card>}
      <Card>
        <CardHeader icon={<FileVideo />} title={t('work.history')} />
        <History items={deal.submissions} />
      </Card>
      <Amendments items={deal.amendments} />
      <Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
        to={`/${viewer}/messages?new=1&topic=DEAL&id=${deal.id}&subject=${encodeURIComponent(deal.campaignTitle ?? t('dealType.INTRO_REEL'))}`}>
        <MessagesSquare className="h-4 w-4" aria-hidden="true" /> {t('messages.askAboutDeal')}
      </Link>
    </>
  );
}
