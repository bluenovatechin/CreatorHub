/**
 * CAMPAIGN → APPLICATIONS (campaign managers): creators who applied to this campaign, with their pitch.
 *   "Shortlist" adds the creator to the brand's shortlist at the payout entered here (brand price: standard margin
 *   unless set). "Decline" closes the application; the creator sees the optional note.
 * Shown on the campaign detail page. API: apps/api/src/modules/admin/applications.routes.ts.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Dialog, Field, Input, Textarea } from '@bluenova/ui';
import { api, date, errorText, rupees } from '../../lib';
import { QState, Status } from '../../components/common';

interface AdminApplication {
  id: string; status: string; pitch: string; proposedRatePaise: number | null; decisionNote: string | null; createdAt: string;
  creator: { id: string; displayName: string | null; city: string | null; stats: { followers?: number }; rateCardPaise: Record<string, number> } | null;
}

export function ApplicationsCard({ campaignId, shortlistOpen }: { campaignId: string; shortlistOpen: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['applications', campaignId], queryFn: () => api.get<AdminApplication[]>(`/admin/campaigns/${campaignId}/applications`) });
  const [payout, setPayout] = useState<Record<string, string>>({});
  const [price, setPrice] = useState<Record<string, string>>({});
  const [declining, setDeclining] = useState<AdminApplication | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const refresh = () => ['applications', 'campaign', 'matches'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const decide = useMutation({
    mutationFn: (v: { id: string; body: object }) => api.post(`/admin/applications/${v.id}/decision`, v.body),
    onMutate: () => setError(null),
    onSuccess: () => { setDeclining(null); setNote(''); refresh(); },
    onError: (e) => setError(errorText(e)),
  });

  const defaultPayout = (a: AdminApplication) =>
    a.proposedRatePaise ? String(a.proposedRatePaise / 100) : a.creator?.rateCardPaise.REEL ? String(a.creator.rateCardPaise.REEL / 100) : '';

  return (
    <Card>
      <h2 className="font-semibold">Applications</h2>
      <p className="mb-3 text-sm text-ink-muted">Creators who applied. The brand never sees applications, only who you shortlist.</p>
      {error && !declining && <div className="mb-3"><Alert tone="red">{error}</Alert></div>}
      {q.isLoading || q.error ? <QState q={q} /> : q.data!.length === 0 ? <p className="text-sm text-ink-muted">No applications yet.</p> : (
        <ul className="divide-y divide-line">
          {q.data!.map((a) => {
            const payoutValue = payout[a.id] ?? defaultPayout(a);
            return (
              <li key={a.id} className="space-y-2 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  {a.creator && <Link to={`/creators/${a.creator.id}`} className="font-semibold text-primary">{a.creator.displayName}</Link>}
                  <Status s={a.status} />
                  <span className="text-xs text-ink-muted">
                    {a.creator?.stats.followers?.toLocaleString('en-IN')} followers · asked {a.proposedRatePaise ? rupees(a.proposedRatePaise) : '—'} · {date(a.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-line rounded-xl bg-bg p-3 text-sm">“{a.pitch}”</p>
                {a.decisionNote && <p className="text-xs text-ink-muted">Note: {a.decisionNote}</p>}
                {a.status === 'SUBMITTED' && (
                  <div className="flex flex-wrap items-end gap-2">
                    <Input aria-label="Payout ₹" placeholder="Payout ₹" inputMode="numeric" className="w-32" value={payoutValue}
                      onChange={(e) => setPayout((p) => ({ ...p, [a.id]: e.target.value.replace(/\D/g, '') }))} />
                    <Input aria-label="Brand price ₹" placeholder="Brand price (auto)" inputMode="numeric" className="w-40" value={price[a.id] ?? ''}
                      onChange={(e) => setPrice((p) => ({ ...p, [a.id]: e.target.value.replace(/\D/g, '') }))} />
                    <Button size="sm" disabled={!shortlistOpen || !payoutValue} loading={decide.isPending && decide.variables?.id === a.id && !declining}
                      title={shortlistOpen ? undefined : 'Claim the campaign first'}
                      onClick={() => decide.mutate({ id: a.id, body: { decision: 'SHORTLIST', creatorPayout: Number(payoutValue), brandPrice: price[a.id] ? Number(price[a.id]) : undefined } })}>
                      Shortlist
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { setError(null); setNote(''); setDeclining(a); }}>Decline</Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={!!declining} onClose={() => setDeclining(null)} title={`Decline ${declining?.creator?.displayName ?? 'this application'}?`}
        footer={<>
          <Button variant="secondary" onClick={() => setDeclining(null)}>Cancel</Button>
          <Button variant="danger" loading={decide.isPending} onClick={() => decide.mutate({ id: declining!.id, body: { decision: 'DECLINE', note: note.trim() || undefined } })}>Decline</Button>
        </>}>
        <div className="space-y-4 text-sm">
          <Field label="Note for the creator (optional, they will see it)">{(id) => <Textarea id={id} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
          {error && <Alert tone="red">{error}</Alert>}
        </div>
      </Dialog>
    </Card>
  );
}
