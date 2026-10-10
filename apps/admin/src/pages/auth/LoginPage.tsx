import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Mail, Lock, ShieldCheck } from 'lucide-react';
import { Alert, Button, Field, Input, PasswordInput, cx } from '@bluenova/ui';
import { api, errorText, useAdmin, type AdminMe } from '../../lib';

export function AdminLogo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient font-display text-lg font-extrabold text-white shadow-btn" aria-hidden="true">B</span>
      <span className={cx('font-display leading-none', light ? 'text-white' : 'text-navy')}>
        <span className="block text-[17px] font-extrabold">Bluenova</span>
        <span className={cx('block text-[11px] font-semibold uppercase tracking-[0.14em]', light ? 'text-primary-200' : 'text-primary')}>Admin panel</span>
      </span>
    </Link>
  );
}

export function LoginPage() {
  const { signIn, me } = useAdmin();
  const navigate = useNavigate();
  // 'recovery' = lost phone: a one-time recovery code replaces the authenticator code.
  const [step, setStep] = useState<'password' | 'totp' | 'recovery'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (me) navigate('/', { replace: true }); }, [me, navigate]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (step === 'password') {
        const r = await api.post<{ mfaToken?: string; accessToken?: string; user?: AdminMe }>('/auth/admin/login', { email, password });
        setPassword('');
        if (r.accessToken && r.user) {
          // Two-step login is switched off on the server (testing): the password was enough.
          signIn(r.accessToken, r.user);
          navigate('/', { replace: true });
          return;
        }
        setMfaToken(r.mfaToken!);
        setStep('totp');
      } else if (step === 'totp') {
        const r = await api.post<{ accessToken: string; user: AdminMe }>('/auth/admin/totp/verify', { mfaToken, code });
        signIn(r.accessToken, r.user);
        navigate('/', { replace: true });
      } else {
        const r = await api.post<{ accessToken: string; user: AdminMe; recoveryCodesLeft: number }>('/auth/admin/recovery', { mfaToken, code });
        signIn(r.accessToken, r.user);
        // Straight to Settings → Security, which asks them to set up the authenticator on their new phone.
        navigate(`/settings?recovered=${r.recoveryCodesLeft}`, { replace: true });
      }
    } catch (e) {
      setError(errorText(e));
      if (step !== 'password') setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-gradient px-4 py-12">
      <div className="w-full max-w-md animate-fade-up rounded-[24px] bg-white p-8 shadow-lift">
        <AdminLogo />
        <h1 className="mt-8 font-display text-2xl font-extrabold text-navy">{step === 'password' ? 'Team sign in' : step === 'totp' ? 'Two-step verification' : 'Use a recovery code'}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {step === 'password' ? 'Bluenova team members only.'
            : step === 'totp' ? 'Enter the 6-digit code from your authenticator app.'
              : 'Lost your phone? Enter one of the recovery codes you saved when your account was set up. Each code works once.'}
        </p>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="mt-6 space-y-5" noValidate>
          {step === 'password' ? (
            <>
              <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="username" icon={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
              <Field label="Password">{(id) => <PasswordInput id={id} autoComplete="current-password" icon={<Lock />} value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
            </>
          ) : step === 'recovery' ? (
            <Field label="Recovery code" hint="Looks like ABCD-EFGH-JKLM">
              {(id) => <Input id={id} autoComplete="off" autoFocus icon={<KeyRound />} className="font-mono uppercase tracking-wider"
                value={code} onChange={(e) => setCode(e.target.value.slice(0, 24))} />}
            </Field>
          ) : (
            <Field label="Authenticator code">
              {(id) => <Input id={id} inputMode="numeric" maxLength={6} autoComplete="one-time-code" autoFocus icon={<ShieldCheck />}
                className="text-center font-mono text-2xl tracking-[0.5em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />}
            </Field>
          )}
          {error && <Alert tone="red">{error}</Alert>}
          <Button type="submit" block size="lg" loading={busy} disabled={step === 'password' ? !email || !password : step === 'totp' ? code.length !== 6 : code.trim().length < 12}>
            {step === 'password' ? 'Continue' : 'Verify & sign in'}
          </Button>
          {step !== 'password' && (
            <div className="flex justify-between text-sm font-semibold text-primary">
              <button type="button" onClick={() => { setStep('password'); setCode(''); setError(null); }}>Start over</button>
              <button type="button" onClick={() => { setStep(step === 'totp' ? 'recovery' : 'totp'); setCode(''); setError(null); }}>
                {step === 'totp' ? 'Lost your phone?' : 'Use the authenticator app'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
