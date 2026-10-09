/**
 * ADMIN FINANCE + SETTINGS: payments to verify (only when payments are ON), payments on/off switch,
 * bank/UPI details, and changing your own admin password.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound, Landmark, Lock, ToggleRight, Wallet, XCircle } from 'lucide-react';
import {
  Alert, Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, Input, Loading, PageHeader, PasswordInput,
  PasswordStrength, Textarea, cx,
} from '@bluenova/ui';
import { api, can, date, errorText, rupees, tone, useAdmin, useFeatures } from '../lib';

interface AdminPayment {
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
  const review = useMutation({
    mutationFn: () => api.post(`/admin/payments/${reviewing!.p.id}/review`, { decision: reviewing!.decision, reason: reason || undefined }),
    onSuccess: () => { setReviewing(null); setReason(''); void qc.invalidateQueries({ queryKey: ['payments'] }); void qc.invalidateQueries({ queryKey: ['dashboard'] }); },
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

interface PaymentSettings { configured: boolean; accountName?: string; bankName?: string; accountNumber?: string; ifsc?: string; upiId?: string | null; instructions?: string | null; gstRateBps: number }

function BankDetailsCard() {
  const { me } = useAdmin();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['settings', 'payment'], queryFn: () => api.get<PaymentSettings>('/admin/settings/payment') });
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: () => api.put('/admin/settings/payment', form),
    onSuccess: () => { setSaved(true); setForm(null); void qc.invalidateQueries({ queryKey: ['settings', 'payment'] }); },
    onError: (e) => setError(errorText(e)),
  });
  if (!can(me, 'finance')) return null;
  if (q.isLoading) return <Loading />;
  const d = q.data;
  const editable = me?.adminRole === 'super_admin';
  const f = form ?? { accountName: d?.accountName ?? '', bankName: d?.bankName ?? '', accountNumber: d?.accountNumber ?? '', ifsc: d?.ifsc ?? '', upiId: d?.upiId ?? '', instructions: d?.instructions ?? '' };
  const set = (k: string) => (e: { target: { value: string } }) => { setSaved(false); setForm({ ...f, [k]: e.target.value }); };
  return (
    <Card>
      <CardHeader icon={<Landmark />} title="Bluenova bank details" subtitle="Shown to brands on the payment page. Only super admins can change them; every change is audited." />
      {!d?.configured && <div className="mb-4"><Alert tone="amber">Not set yet — brands cannot submit payments until these are saved.</Alert></div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Account name">{(id) => <Input id={id} disabled={!editable} value={f.accountName} onChange={set('accountName')} />}</Field>
        <Field label="Bank name">{(id) => <Input id={id} disabled={!editable} value={f.bankName} onChange={set('bankName')} />}</Field>
        <Field label="Account number">{(id) => <Input id={id} disabled={!editable} inputMode="numeric" className="font-mono" value={f.accountNumber} onChange={set('accountNumber')} />}</Field>
        <Field label="IFSC">{(id) => <Input id={id} disabled={!editable} className="font-mono uppercase" value={f.ifsc} onChange={set('ifsc')} />}</Field>
        <Field label="UPI ID (optional)">{(id) => <Input id={id} disabled={!editable} value={f.upiId} onChange={set('upiId')} />}</Field>
        <Field label="Instructions for brands (optional)">{(id) => <Input id={id} disabled={!editable} value={f.instructions} onChange={set('instructions')} />}</Field>
      </div>
      {error && <div className="mt-4"><Alert tone="red">{error}</Alert></div>}
      {saved && <div className="mt-4"><Alert tone="green">Saved.</Alert></div>}
      {editable && <Button className="mt-5" disabled={!form} loading={save.isPending} onClick={() => { setError(null); save.mutate(); }}>Save bank details</Button>}
    </Card>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const change = useMutation({
    mutationFn: () => api.post<{ accessToken: string }>('/auth/admin/password/change', { currentPassword: current, password, confirmPassword: confirm }),
    onSuccess: (r) => { api.setToken(r.accessToken); setDone(true); setCurrent(''); setPassword(''); setConfirm(''); },
    onError: (e) => setError(errorText(e)),
  });
  return (
    <Card>
      <CardHeader icon={<KeyRound />} title="Change password" subtitle="Other devices are logged out when you change it." />
      <div className="space-y-4">
        <Field label="Current password">{(id) => <PasswordInput id={id} autoComplete="current-password" icon={<Lock />} value={current} onChange={(e) => setCurrent(e.target.value)} />}</Field>
        <Field label="New password">{(id) => (
          <div className="space-y-2.5">
            <PasswordInput id={id} autoComplete="new-password" icon={<Lock />} value={password} onChange={(e) => setPassword(e.target.value)} />
            <PasswordStrength password={password} labels={{ length: '8+ characters', mix: 'Letters & numbers', strength: 'Strength', levels: ['—', 'Weak', 'Fair', 'Good', 'Strong'] }} />
          </div>
        )}</Field>
        <Field label="Confirm new password">{(id) => <PasswordInput id={id} autoComplete="new-password" icon={<KeyRound />} value={confirm} onChange={(e) => setConfirm(e.target.value)} />}</Field>
        {error && <Alert tone="red">{error}</Alert>}
        {done && <Alert tone="green">Password changed.</Alert>}
        <Button loading={change.isPending} disabled={!current || !password || !confirm} onClick={() => { setError(null); setDone(false); change.mutate(); }}>Save new password</Button>
      </div>
    </Card>
  );
}

function FeaturesCard() {
  const { me } = useAdmin();
  const { paymentsEnabled, loaded } = useFeatures();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const toggle = useMutation({
    mutationFn: (v: boolean) => api.put('/admin/settings/features', { paymentsEnabled: v }),
    onSuccess: () => { void qc.invalidateQueries(); },
    onError: (e) => setError(errorText(e)),
  });
  if (!loaded) return null;
  const editable = me?.adminRole === 'super_admin';
  return (
    <Card>
      <CardHeader icon={<ToggleRight />} title="Payments on the website"
        subtitle={paymentsEnabled
          ? 'ON — brands see the payment page and submit bank/UPI transfer details; finance verifies them.'
          : 'OFF — nothing about payments is shown on the website. After creators accept, a campaign manager presses “Start campaign” (payment is arranged outside the website).'} />
      <Badge tone={paymentsEnabled ? 'green' : 'grey'}>{paymentsEnabled ? 'On' : 'Off'}</Badge>
      {editable && (
        <Button className="ml-3" variant={paymentsEnabled ? 'secondary' : 'primary'} size="sm" loading={toggle.isPending}
          onClick={() => { setError(null); toggle.mutate(!paymentsEnabled); }}>
          {paymentsEnabled ? 'Turn payments off' : 'Turn payments on'}
        </Button>
      )}
      {!editable && <p className="mt-3 text-sm text-ink-muted">Only a super admin can change this.</p>}
      {error && <div className="mt-4"><Alert tone="red">{error}</Alert></div>}
    </Card>
  );
}

export function SettingsPage() {
  const { me } = useAdmin();
  const { paymentsEnabled } = useFeatures();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Settings" subtitle={`${me?.name} · ${me?.email}`} />
      <FeaturesCard />
      {paymentsEnabled && <BankDetailsCard />}
      <ChangePasswordCard />
    </div>
  );
}
