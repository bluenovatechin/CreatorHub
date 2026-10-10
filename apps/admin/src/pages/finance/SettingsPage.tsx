import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Landmark, Lock, Mail, ToggleRight } from 'lucide-react';
import {
  Alert, Badge, Button, Card, CardHeader, Field, Input, Loading, PageHeader, PasswordInput,
  PasswordStrength,
} from '@bluenova/ui';
import { api, can, errorText, useAdmin, useFeatures } from '../../lib';
import { SecurityCard } from './SecurityCard';

interface PaymentSettings {
  configured: boolean; accountName?: string; bankName?: string; accountNumber?: string; ifsc?: string;
  upiId?: string | null; instructions?: string | null; gstRateBps: number;
}

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

interface EmailCheck { sent: boolean; reason: string | null; provider: string; from: string; testMode: boolean; to: string }

function emailFix(r: EmailCheck): string | null {
  const why = (r.reason ?? '').toLowerCase();
  if (r.provider === 'console') return r.testMode
    ? 'TEST_MODE is on: emails are not really sent (they only appear in the server log). On Render set EMAIL_PROVIDER=brevo and TEST_MODE=false.'
    : 'EMAIL_PROVIDER is "console", so nothing is really sent. On Render set EMAIL_PROVIDER=brevo.';
  if (!r.sent && r.provider === 'smtp') return "Render's free plan blocks Gmail/SMTP. On Render set EMAIL_PROVIDER=brevo, BREVO_API_KEY and EMAIL_FROM.";
  if (why.includes('ip address') || why.includes('unrecognised ip')) return "Brevo is blocking this server's IP address. Brevo → ⚙️ → Security → Authorized IPs → deactivate the blocking (Render's IP address changes).";
  if (why.includes('sender') || why.includes('from')) return `Brevo doesn't accept the sender "${r.from}". Set EMAIL_FROM on Render to the exact email shown as Verified in Brevo → ⚙️ → Senders.`;
  if (why.includes('key') || why.includes('unauthorized') || why.includes('401')) return 'The Brevo API key is wrong or deleted. Create a new one in Brevo → ⚙️ → SMTP & API → API Keys and set BREVO_API_KEY on Render.';
  if (why.includes('not yet activated') || why.includes('activat') || why.includes('phone')) return 'Your Brevo account is not activated for sending yet (verify your phone in Brevo, or contact Brevo support).';
  return null;
}

function EmailCheckCard() {
  const [result, setResult] = useState<EmailCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const check = useMutation({
    mutationFn: () => api.post<EmailCheck>('/admin/settings/test-email'),
    onMutate: () => { setError(null); setResult(null); },
    onSuccess: (r) => setResult(r),
    onError: (e) => setError(errorText(e)),
  });
  const fix = result ? emailFix(result) : null;
  return (
    <Card>
      <CardHeader icon={<Mail />} title="Email delivery"
        subtitle="Signup codes and password emails. Press the button to send one test email to your own address from this server." />
      <Button size="sm" variant="secondary" loading={check.isPending} onClick={() => check.mutate()}>Send test email</Button>
      {result && (
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-ink-muted">Mode: <b>{result.provider}</b> · From: <b>{result.from}</b> · To: <b>{result.to}</b>{result.testMode ? ' · TEST_MODE on' : ''}</p>
          {result.sent && result.provider !== 'console'
            ? <Alert tone="green" title="Sent">Check {result.to} (and the spam folder) within a minute. If it arrives, signup codes work too.</Alert>
            : <Alert tone="red" title="Not delivered">{result.reason ? <p className="break-words">Reason: {result.reason}</p> : null}{fix ? <p className="mt-2 font-semibold">How to fix: {fix}</p> : null}</Alert>}
        </div>
      )}
      {error && <div className="mt-3"><Alert tone="red">{error}</Alert></div>}
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
      {me?.adminRole === 'super_admin' && <EmailCheckCard />}
      {paymentsEnabled && <BankDetailsCard />}
      <SecurityCard />
      <ChangePasswordCard />
    </div>
  );
}
