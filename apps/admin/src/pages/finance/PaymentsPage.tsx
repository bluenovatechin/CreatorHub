import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Wallet, XCircle } from 'lucide-react';
import {
  Alert, Badge, Button, Card, Dialog, EmptyState, Field, Loading, PageHeader, Textarea, cx, useIdempotencyKey } from '@bluenova/ui';
import { api, can, date, errorText, rupees, tone, useAdmin } from '../../lib';

export interface AdminPayment {
  id: string; status: 'SUBMITTED' | 'VERIFIED' | 'REJECTED'; method: string; reference: string; amountPaidPaise: number; totalPaise: number;
  subtotalPaise: number; gst: { rateBps: number; cgstPaise: number; sgstPaise: number; igstPaise: number };
  paidOn: string; payerName: string; note: string | null; rejectReason: string | null; createdAt: string; dealCount: number;
  campaignId: string; campaignTitle: string; companyName: string; gstin: string | null;
}

export function PaymentsPage() {
  const { me } = useAdmin();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'SUBMITTED';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['payments', status], queryFn: () => api.get<AdminPayment[]>(`/admin/payments?limit=50${status !== 'ALL' ? `&status=${status}` : ''}`) });
  const [reviewing, setReviewing] = useState<{ p: AdminPayment; decision: 'VERIFIED' | 'REJECTED' } | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const idem = useIdempotencyKey(); // a double click verifies/rejects the payment only once
  const review = useMutation({
    mutationFn: () => {
      const body = { decision: reviewing!.decision, reason: reason || undefined };
      return api.post(`/admin/payments/${reviewing!.p.id}/review`, body, { idempotencyKey: idem.keyFor({ id: reviewing!.p.id, ...body }) });
    },
    onSuccess: () => { idem.renew(); setReviewing(null); setReason(''); void qc.invalidateQueries({ queryKey: ['payments'] }); void qc.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (e) => setError(errorText(e)),
  });
  const finance = can(me, 'finance');

  return (
    <div>
      <PageHeader title="Payments" subtitle="Brands pay by bank transfer / UPI. Match each reference with the bank statement before verifying." />
      <div className="mb-5 flex flex-wrap gap-2">
        {['SUBMITTED', 'VERIFIED', 'REJECTED', 'ALL'].map((s) => (
          <button key={s} type="button" onClick={() => setParams({ status: s })}
            className={cx('min-h-9 rounded-full px-4 text-sm font-semibold', status === s ? 'bg-primary text-white' : 'border border-line bg-white text-ink-muted hover:text-navy')}>
            {s === 'SUBMITTED' ? 'To verify' : s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      {q.isLoading ? <Loading /> : q.error ? <Alert tone="red">{errorText(q.error)}</Alert> : q.data!.length === 0 ? (
        <EmptyState icon={<Wallet />} title="Nothing here" text={status === 'SUBMITTED' ? 'No payments waiting for verification.' : undefined} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {q.data!.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">{p.companyName}</p>
                  <Link to={`/campaigns/${p.campaignId}`} className="font-display text-lg font-bold text-navy hover:underline">{p.campaignTitle}</Link>
                </div>
                <Badge tone={tone(p.status)}>{p.status === 'SUBMITTED' ? 'To verify' : p.status.toLowerCase()}</Badge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-ink-muted">Amount paid</dt><dd className="font-display text-xl font-extrabold text-navy">{rupees(p.amountPaidPaise)}</dd></div>
                <div><dt className="text-ink-muted">Expected total</dt><dd className={cx('font-semibold', p.amountPaidPaise === p.totalPaise ? 'text-success' : 'text-danger')}>{rupees(p.totalPaise)}</dd></div>
                <div><dt className="text-ink-muted">Method</dt><dd className="font-semibold">{p.method}</dd></div>
                <div><dt className="text-ink-muted">Reference (UTR)</dt><dd className="font-mono font-semibold">{p.reference}</dd></div>
                <div><dt className="text-ink-muted">Paid on</dt><dd>{date(p.paidOn).split(',')[0]}</dd></div>
                <div><dt className="text-ink-muted">Paid by</dt><dd>{p.payerName}</dd></div>
                <div><dt className="text-ink-muted">GSTIN</dt><dd className="font-mono">{p.gstin ?? '—'}</dd></div>
                <div><dt className="text-ink-muted">Creators</dt><dd>{p.dealCount}</dd></div>
              </dl>
              {p.note && <p className="mt-3 rounded-xl bg-bg p-3 text-sm">“{p.note}”</p>}
              {p.rejectReason && <p className="mt-3 text-sm text-danger">Rejected: {p.rejectReason}</p>}
              <p className="mt-3 text-xs text-ink-faint">Submitted {date(p.createdAt)}</p>
              {p.status === 'SUBMITTED' && finance && (
                <div className="mt-4 flex gap-2 border-t border-line pt-4">
                  <Button variant="accent" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => { setError(null); setReviewing({ p, decision: 'VERIFIED' }); }}>Verify</Button>
                  <Button variant="secondary" icon={<XCircle className="h-4 w-4" />} onClick={() => { setError(null); setReviewing({ p, decision: 'REJECTED' }); }}>Reject</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <Dialog open={!!reviewing} onClose={() => setReviewing(null)} title={reviewing?.decision === 'VERIFIED' ? 'Verify this payment?' : 'Reject this payment?'}
        footer={<>
          <Button variant="secondary" onClick={() => setReviewing(null)}>Cancel</Button>
          <Button variant={reviewing?.decision === 'VERIFIED' ? 'accent' : 'danger'} loading={review.isPending}
            disabled={reviewing?.decision === 'REJECTED' && reason.trim().length < 3} onClick={() => review.mutate()}>
            {reviewing?.decision === 'VERIFIED' ? 'Yes, verified in bank statement' : 'Reject payment'}
          </Button>
        </>}>
        {reviewing && (
          <div className="space-y-4 text-sm">
            <p>{rupees(reviewing.p.amountPaidPaise)} via {reviewing.p.method}, reference <span className="font-mono font-semibold">{reviewing.p.reference}</span>.</p>
            {reviewing.decision === 'VERIFIED'
              ? <Alert tone="amber">Only verify after you have seen this exact amount and reference in Bluenova's bank statement. Creators start work immediately.</Alert>
              : <Field label="Reason (the brand will see this)">{(id) => <Textarea id={id} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>}
            {error && <Alert tone="red">{error}</Alert>}
          </div>
        )}
      </Dialog>
    </div>
  );
}
