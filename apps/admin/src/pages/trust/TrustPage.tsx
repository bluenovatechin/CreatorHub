/**
 * DISPUTES & REPORTS (/trust). Two tabs:
 *   Disputes (campaign managers): problems raised on running brand deals. The deal is paused until you decide:
 *     "Continue" puts it back where it was; "Cancel deal" ends it. Both sides see your note. No money moves
 *     automatically: settle any refund or payout for a cancelled deal outside the website.
 *   Reports (reviewers + campaign managers): campaigns/creators reported by users. Mark them actioned or dismissed
 *     (your note stays internal; the reporter is only told it was reviewed).
 * API: apps/api/src/modules/admin/trust.routes.ts.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Flag, ShieldAlert } from 'lucide-react';
import { Alert, Badge, Button, Card, Dialog, EmptyState, Field, PageHeader, Textarea, cx } from '@bluenova/ui';
import { api, can, date, errorText, label, useAdmin } from '../../lib';
import { QState } from '../../components/common';

interface AdminDispute {
  id: string; dealId: string; campaignId: string | null; campaignTitle: string | null; raisedByRole: 'creator' | 'brand';
  raisedByName: string | null; reason: string; description: string; previousStatus: string; status: 'OPEN' | 'RESOLVED';
  resolution: { outcome: string; note: string } | null; createdAt: string;
}
interface AdminReport {
  id: string; targetType: 'CAMPAIGN' | 'CREATOR'; targetId: string; targetName: string | null; reporterRole: string;
  reporterName: string | null; reason: string; details: string; status: string; reviewNote: string | null; createdAt: string;
}
type Pending = { kind: 'dispute'; id: string; outcome: 'CONTINUE' | 'CANCEL' } | { kind: 'report'; id: string; outcome: 'ACTIONED' | 'DISMISSED' };

const pill = (active: boolean) => cx('min-h-9 rounded-full px-4 text-sm font-semibold', active ? 'bg-primary text-white' : 'border border-line bg-white text-ink-muted hover:text-navy');

export function TrustPage() {
  const { me } = useAdmin();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'reports' || !can(me, 'campaign_manager') ? 'reports' : 'disputes';
  const status = params.get('status') ?? 'OPEN';
  const qc = useQueryClient();
  const disputes = useQuery({ queryKey: ['disputes', status], queryFn: () => api.get<AdminDispute[]>(`/admin/disputes?status=${status}`), enabled: tab === 'disputes' });
  const reports = useQuery({ queryKey: ['reports', status], queryFn: () => api.get<AdminReport[]>(`/admin/reports?status=${status}`), enabled: tab === 'reports' });
  const [pending, setPending] = useState<Pending | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const decide = useMutation({
    mutationFn: () => pending!.kind === 'dispute'
      ? api.post(`/admin/disputes/${pending!.id}/resolve`, { outcome: pending!.outcome, note: note.trim() })
      : api.post(`/admin/reports/${pending!.id}/review`, { outcome: pending!.outcome, note: note.trim() || undefined }),
    onMutate: () => setError(null),
    onSuccess: () => { setPending(null); setNote(''); ['disputes', 'reports', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); },
    onError: (e) => setError(errorText(e)),
  });
  const open = (p: Pending) => { setError(null); setNote(''); setPending(p); };
  const noteRequired = pending?.kind === 'dispute';
  const statuses = tab === 'disputes' ? ['OPEN', 'RESOLVED'] : ['OPEN', 'ACTIONED', 'DISMISSED'];

  return (
    <div>
      <PageHeader title="Disputes & reports" subtitle="Problems on running deals, and campaigns or creators reported by users." />
      <div className="mb-3 flex flex-wrap gap-2">
        {can(me, 'campaign_manager') && <button type="button" className={pill(tab === 'disputes')} onClick={() => setParams({ tab: 'disputes' })}>Disputes</button>}
        <button type="button" className={pill(tab === 'reports')} onClick={() => setParams({ tab: 'reports' })}>Reports</button>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {statuses.map((s) => <button key={s} type="button" className={pill(status === s)} onClick={() => setParams({ tab, status: s })}>{label(s)}</button>)}
      </div>

      {tab === 'disputes' ? (
        disputes.isLoading || disputes.error ? <QState q={disputes} /> : disputes.data!.length === 0 ? <EmptyState icon={<ShieldAlert />} title="No disputes here" /> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {disputes.data!.map((d) => (
              <Card key={d.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-primary">{label(d.reason)}</p>
                    {d.campaignId ? <Link to={`/campaigns/${d.campaignId}`} className="font-display text-lg font-bold text-navy hover:underline">{d.campaignTitle}</Link> : null}
                  </div>
                  <Badge tone={d.status === 'OPEN' ? 'amber' : 'grey'}>{label(d.status)}</Badge>
                </div>
                <p className="mt-2 text-sm text-ink-muted">Raised by the {d.raisedByRole} ({d.raisedByName ?? '—'}) · {date(d.createdAt)} · deal was “{label(d.previousStatus)}”</p>
                <p className="mt-3 whitespace-pre-line rounded-xl bg-bg p-3 text-sm">“{d.description}”</p>
                {d.resolution && <p className="mt-3 text-sm"><b>{label(d.resolution.outcome)}</b>: {d.resolution.note}</p>}
                {d.status === 'OPEN' && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                    <Button variant="accent" onClick={() => open({ kind: 'dispute', id: d.id, outcome: 'CONTINUE' })}>Continue the deal</Button>
                    <Button variant="secondary" onClick={() => open({ kind: 'dispute', id: d.id, outcome: 'CANCEL' })}>Cancel the deal</Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      ) : (
        reports.isLoading || reports.error ? <QState q={reports} /> : reports.data!.length === 0 ? <EmptyState icon={<Flag />} title="No reports here" /> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {reports.data!.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-primary">{label(r.reason)} · {r.targetType === 'CAMPAIGN' ? 'campaign' : 'creator'}</p>
                    <Link to={r.targetType === 'CAMPAIGN' ? `/campaigns/${r.targetId}` : `/creators/${r.targetId}`} className="font-display text-lg font-bold text-navy hover:underline">{r.targetName ?? 'Open'}</Link>
                  </div>
                  <Badge tone={r.status === 'OPEN' ? 'amber' : 'grey'}>{label(r.status)}</Badge>
                </div>
                <p className="mt-2 text-sm text-ink-muted">Reported by a {r.reporterRole} ({r.reporterName ?? '—'}) · {date(r.createdAt)}</p>
                <p className="mt-3 whitespace-pre-line rounded-xl bg-bg p-3 text-sm">“{r.details}”</p>
                {r.reviewNote && <p className="mt-3 text-sm text-ink-muted">Team note: {r.reviewNote}</p>}
                {r.status === 'OPEN' && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                    <Button variant="accent" onClick={() => open({ kind: 'report', id: r.id, outcome: 'ACTIONED' })}>Action taken</Button>
                    <Button variant="secondary" onClick={() => open({ kind: 'report', id: r.id, outcome: 'DISMISSED' })}>Dismiss</Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      )}

      <Dialog open={!!pending} onClose={() => setPending(null)}
        title={pending ? { CONTINUE: 'Continue the deal?', CANCEL: 'Cancel the deal?', ACTIONED: 'Mark as actioned?', DISMISSED: 'Dismiss this report?' }[pending.outcome] : ''}
        footer={<>
          <Button variant="secondary" onClick={() => setPending(null)}>Back</Button>
          <Button variant={pending?.outcome === 'CANCEL' ? 'danger' : 'accent'} loading={decide.isPending} disabled={noteRequired && note.trim().length < 3} onClick={() => decide.mutate()}>Confirm</Button>
        </>}>
        <div className="space-y-4 text-sm">
          {pending?.outcome === 'CANCEL' && <Alert tone="amber">The deal ends for both sides. Settle any refund or creator payout outside the website.</Alert>}
          <Field label={noteRequired ? 'Note (both the creator and the brand will see it)' : 'Internal note (optional)'}>
            {(id) => <Textarea id={id} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          {error && <Alert tone="red">{error}</Alert>}
        </div>
      </Dialog>
    </div>
  );
}
