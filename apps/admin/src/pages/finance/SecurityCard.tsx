/**
 * SETTINGS → SECURITY (every team member, own account). Shown on the Settings page.
 *   - how many one-time recovery codes are left (for a lost authenticator phone)
 *   - "Create new recovery codes": shows 10 codes ONCE; the old ones stop working
 *   - "Set up a new phone": shows a new authenticator key, then asks for one code from the new phone
 * Both actions ask for the current password again. API: /admin/security (apps/api/src/modules/admin/security.routes.ts).
 * After a recovery-code login, the login page sends people here with ?recovered=<codes left>.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Lock, ShieldCheck, Smartphone } from 'lucide-react';
import { Alert, Button, Card, CardHeader, CopyButton, Field, Input, Loading, PasswordInput } from '@bluenova/ui';
import { api, errorText } from '../../lib';

interface SecurityInfo { totpEnabled: boolean; recoveryCodesLeft: number }

/** Asks for the current password, then runs `onConfirm` with it. */
function PasswordGate({ action, busy, onConfirm }: { action: string; busy: boolean; onConfirm: (password: string) => void }) {
  const [password, setPassword] = useState('');
  return (
    <div className="space-y-3">
      <Field label="Current password">{(id) => <PasswordInput id={id} autoComplete="current-password" icon={<Lock />} value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
      <Button size="sm" loading={busy} disabled={!password} onClick={() => onConfirm(password)}>{action}</Button>
    </div>
  );
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="space-y-3">
      <Alert tone="amber" title="Save these codes now">They are shown only once. Keep them in a password manager or on paper, not on your phone. Each code works once.</Alert>
      <ul className="grid grid-cols-2 gap-2 rounded-ctl bg-bg ring-1 ring-inset ring-line p-4 font-mono text-sm">
        {codes.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <CopyButton value={codes.join('\n')} label="Copy all codes" />
    </div>
  );
}

function NewPhone({ onDone }: { onDone: () => void }) {
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const start = useMutation({
    mutationFn: (currentPassword: string) => api.post<{ secret: string; otpauthUrl: string }>('/admin/security/totp/start', { currentPassword }),
    onMutate: () => setError(null),
    onSuccess: setSetup,
    onError: (e) => setError(errorText(e)),
  });
  const confirm = useMutation({
    mutationFn: () => api.post<{ accessToken: string }>('/admin/security/totp/confirm', { code }),
    onMutate: () => setError(null),
    // Other devices were logged out; this tab continues with the fresh session.
    onSuccess: (r) => { api.setToken(r.accessToken); onDone(); },
    onError: (e) => { setError(errorText(e)); setCode(''); },
  });
  return (
    <div className="space-y-3">
      {!setup ? <PasswordGate action="Show new authenticator key" busy={start.isPending} onConfirm={(p) => start.mutate(p)} /> : (
        <>
          <p className="text-sm">On the new phone, open the authenticator app → tap <b>+</b> → <b>Enter a setup key</b> → paste this key:</p>
          <div className="flex flex-wrap items-center gap-3 rounded-ctl bg-bg ring-1 ring-inset ring-line p-3 font-mono text-sm break-all">
            {setup.secret} <CopyButton value={setup.secret} label="Copy key" />
          </div>
          <Field label="Code shown on the new phone">
            {(id) => <Input id={id} inputMode="numeric" maxLength={6} autoComplete="one-time-code" icon={<ShieldCheck />}
              className="font-mono tracking-[0.3em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />}
          </Field>
          <Button size="sm" loading={confirm.isPending} disabled={code.length !== 6} onClick={() => confirm.mutate()}>Switch to the new phone</Button>
          <p className="text-xs text-ink-muted">Until you press this, your old authenticator keeps working.</p>
        </>
      )}
      {error && <Alert tone="red">{error}</Alert>}
    </div>
  );
}

export function SecurityCard() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const recovered = params.get('recovered');
  const q = useQuery({ queryKey: ['security'], queryFn: () => api.get<SecurityInfo>('/admin/security') });
  const [panel, setPanel] = useState<'none' | 'codes' | 'phone'>(recovered !== null ? 'phone' : 'none');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [phoneDone, setPhoneDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (currentPassword: string) => api.post<{ codes: string[] }>('/admin/security/recovery-codes', { currentPassword }),
    onMutate: () => setError(null),
    onSuccess: (r) => { setCodes(r.codes); void qc.invalidateQueries({ queryKey: ['security'] }); },
    onError: (e) => setError(errorText(e)),
  });
  if (q.isLoading) return <Loading />;
  const left = q.data?.recoveryCodesLeft ?? 0;
  return (
    <Card>
      <CardHeader icon={<KeyRound />} title="Security" subtitle="Your two-step login: the authenticator app, plus one-time recovery codes for a lost phone." />
      {recovered !== null && !phoneDone && (
        <div className="mb-4"><Alert tone="amber" title="You signed in with a recovery code">Set up the authenticator on your new phone below. Recovery codes left: {recovered}.</Alert></div>
      )}
      <p className="text-sm">Recovery codes left: <b>{left}</b>{left <= 3 ? <span className="ml-2 text-danger">— create new ones soon</span> : null}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant={panel === 'codes' ? 'primary' : 'secondary'} onClick={() => { setPanel('codes'); setCodes(null); }}>
          <KeyRound className="h-4 w-4" aria-hidden="true" /> Create new recovery codes
        </Button>
        <Button size="sm" variant={panel === 'phone' ? 'primary' : 'secondary'} onClick={() => { setPanel('phone'); setPhoneDone(false); }}>
          <Smartphone className="h-4 w-4" aria-hidden="true" /> Set up a new phone
        </Button>
      </div>
      <div className="mt-5">
        {panel === 'codes' && (codes ? <RecoveryCodes codes={codes} /> : (
          <>
            <p className="mb-3 text-sm text-ink-muted">Your old recovery codes stop working as soon as new ones are created.</p>
            <PasswordGate action="Create 10 new codes" busy={create.isPending} onConfirm={(p) => create.mutate(p)} />
            {error && <div className="mt-3"><Alert tone="red">{error}</Alert></div>}
          </>
        ))}
        {panel === 'phone' && (phoneDone
          ? <Alert tone="green">Done. Your new phone is now your authenticator, and other devices were logged out.</Alert>
          : <NewPhone onDone={() => setPhoneDone(true)} />)}
      </div>
    </Card>
  );
}
