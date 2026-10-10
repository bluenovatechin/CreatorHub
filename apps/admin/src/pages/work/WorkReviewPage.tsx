/**
 * WORK REVIEW (/deals): creators' draft links and live post links waiting for the team.
 *   Draft  → "Approve" forwards it to the brand (brand deals) or approves it (intro reels); "Send back" needs a note.
 *   Live   → "Verify" completes the deal (and the campaign when it was the last one); "Ask for a fix" needs a note.
 * "Overdue" lists work whose deadline passed while it was the creator's turn. Campaign managers can also change the
 * agreed terms or cancel a deal (DealAdminActions). Campaign managers see everything; reviewers see intro reels only.
 * API: apps/api/src/modules/admin/deals.routes.ts.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Undo2 } from 'lucide-react';
import { Alert, Badge, Button, Card, Dialog, EmptyState, ExternalLink, Field, Loading, PageHeader, Textarea, cx } from '@bluenova/ui';
import { api, can, date, errorText, label, tone, useAdmin } from '../../lib';
import { DealAdminActions } from './DealAdminActions';

interface Review { by: 'team' | 'brand'; decision: string; note: string | null; at: string }
interface Submission { id: string; kind: 'DRAFT' | 'LIVE'; url: string; note: string | null; submittedAt: string; sharedWithBrand: boolean; reviews: Review[] }
export interface AdminDeal {
  id: string; type: 'BRAND' | 'INTRO_REEL'; status: string; creatorId: string; campaignId: string | null;
  creatorName: string | null; campaignTitle: string | null; maxRevisions: number; brandRevisionsUsed: number; submissions: Submission[];
  deadlines: { draftDue: string; liveDue: string } | null;
}
type Decision = 'APPROVE' | 'REVISION' | 'VERIFY' | 'REJECT';

const FILTERS: [string, string][] = [
  ['WAITING', 'Waiting for team'], ['OVERDUE', 'Overdue'], ['IN_PRODUCTION', 'Being made'], ['BRAND_REVIEW', 'With brand'], ['REVISION_REQUESTED', 'Changes requested'],
  ['APPROVED', 'Approved, not live'], ['COMPLETED', 'Completed'],
];

const TITLES: Record<Decision, (type: AdminDeal['type']) => string> = {
  APPROVE: (type) => (type === 'BRAND' ? 'Forward this draft to the brand?' : 'Approve this draft?'),
  REVISION: () => 'Send the draft back?',
  VERIFY: () => 'Verify the live post?',
  REJECT: () => 'Ask the creator to fix the live post?',
};

export function WorkReviewPage() {
  const { me } = useAdmin();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'WAITING';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['deals', status], queryFn: () => api.get<AdminDeal[]>(`/admin/deals?limit=50&status=${status}`) });
  const [acting, setActing] = useState<{ d: AdminDeal; decision: Decision } | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const act = useMutation({
    mutationFn: () => {
      const path = acting!.decision === 'VERIFY' || acting!.decision === 'REJECT' ? 'live-review' : 'draft-review';
      return api.post(`/admin/deals/${acting!.d.id}/${path}`, { decision: acting!.decision, note: note.trim() || undefined });
    },
    onSuccess: () => {
      setActing(null);
      setNote('');
      void qc.invalidateQueries({ queryKey: ['deals'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => setError(errorText(e)),
  });
  const open = (d: AdminDeal, decision: Decision) => { setError(null); setNote(''); setActing({ d, decision }); };
  const needsNote = acting?.decision === 'REVISION' || acting?.decision === 'REJECT';

  return (
    <div>
      <PageHeader title="Work review" subtitle="Creators' draft links and live posts. Open every link before deciding." />
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map(([s, text]) => (
          <button key={s} type="button" onClick={() => setParams({ status: s })}
            className={cx('min-h-9 rounded-full px-4 text-sm font-semibold', status === s ? 'bg-primary text-white' : 'border border-line bg-white text-ink-muted hover:text-navy')}>
            {text}
          </button>
        ))}
      </div>
      {q.isLoading ? <Loading /> : q.error ? <Alert tone="red">{errorText(q.error)}</Alert> : q.data!.length === 0 ? (
        <EmptyState icon={<ClipboardCheck />} title="Nothing here" text={status === 'WAITING' ? 'No work is waiting for the team.' : undefined} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {q.data!.map((d) => {
            const last = d.submissions[d.submissions.length - 1];
            return (
              <Card key={d.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-primary">{d.type === 'INTRO_REEL' ? 'Intro reel' : d.campaignTitle}</p>
                    <Link to={`/creators/${d.creatorId}`} className="font-display text-lg font-bold text-navy hover:underline">{d.creatorName ?? 'Creator'}</Link>
                  </div>
                  <Badge tone={tone(d.status)}>{label(d.status)}</Badge>
                </div>
                {last ? (
                  <div className="mt-4 space-y-2 text-sm">
                    <p className="font-semibold">{last.kind === 'DRAFT' ? 'Draft' : 'Live post'} · <span className="font-normal text-ink-muted">{date(last.submittedAt)}</span></p>
                    <p className="break-all"><ExternalLink href={last.url}>{last.url}</ExternalLink></p>
                    {last.note && <p className="rounded-xl bg-bg p-3">“{last.note}”</p>}
                    {last.reviews.map((r, i) => (
                      <p key={i} className="text-xs text-ink-muted">{r.by === 'brand' ? 'Brand' : 'Team'}: {label(r.decision)}{r.note ? ` — ${r.note}` : ''}</p>
                    ))}
                    {d.type === 'BRAND' && <p className="text-xs text-ink-faint">Brand change requests used: {d.brandRevisionsUsed}/{d.maxRevisions}</p>}
                  </div>
                ) : <p className="mt-4 text-sm text-ink-muted">No work sent yet.</p>}
                {d.deadlines && <p className="mt-2 text-xs text-ink-muted">Draft due {date(d.deadlines.draftDue).split(',')[0]} · live by {date(d.deadlines.liveDue).split(',')[0]}</p>}
                {can(me, 'campaign_manager') && <DealAdminActions deal={d} />}
                {(d.status === 'DRAFT_SUBMITTED' || d.status === 'LIVE_SUBMITTED') && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                    {d.status === 'DRAFT_SUBMITTED' ? (
                      <>
                        <Button variant="accent" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => open(d, 'APPROVE')}>{d.type === 'BRAND' ? 'Forward to brand' : 'Approve'}</Button>
                        <Button variant="secondary" icon={<Undo2 className="h-4 w-4" />} onClick={() => open(d, 'REVISION')}>Send back</Button>
                      </>
                    ) : (
                      <>
                        <Button variant="accent" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => open(d, 'VERIFY')}>Verify live post</Button>
                        <Button variant="secondary" icon={<Undo2 className="h-4 w-4" />} onClick={() => open(d, 'REJECT')}>Ask for a fix</Button>
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <Dialog open={!!acting} onClose={() => setActing(null)} title={acting ? TITLES[acting.decision](acting.d.type) : ''}
        footer={<>
          <Button variant="secondary" onClick={() => setActing(null)}>Cancel</Button>
          <Button variant={needsNote ? 'danger' : 'accent'} loading={act.isPending} disabled={needsNote && note.trim().length < 3} onClick={() => act.mutate()}>Confirm</Button>
        </>}>
        <div className="space-y-4 text-sm">
          {acting?.decision === 'VERIFY' && <Alert tone="amber">Check the post is public, matches the approved draft, and the caption has #ad. The deal is then completed.</Alert>}
          <Field label={needsNote ? 'What should the creator change? (they will see this)' : 'Note (optional)'}>
            {(id) => <Textarea id={id} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          {error && <Alert tone="red">{error}</Alert>}
        </div>
      </Dialog>
    </div>
  );
}
