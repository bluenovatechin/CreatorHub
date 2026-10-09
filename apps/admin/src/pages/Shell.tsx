/**
 * ADMIN LOGIN (step 1 email + password → step 2 authenticator code) and the page frame (sidebar menu).
 */
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Contact, FileClock, LayoutDashboard, Lock, LogOut, Mail, Megaphone, Settings, ShieldCheck, Users, Wallet,
} from 'lucide-react';
import { Alert, Avatar, Button, Field, Input, PasswordInput, cx } from '@bluenova/ui';
import { api, can, errorText, useAdmin, useFeatures, type AdminMe } from '../lib';

function Logo({ light = false }: { light?: boolean }) {
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
  const [step, setStep] = useState<'password' | 'totp'>('password');
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
        const r = await api.post<{ mfaToken: string }>('/auth/admin/login', { email, password });
        setMfaToken(r.mfaToken);
        setPassword('');
        setStep('totp');
      } else {
        const r = await api.post<{ accessToken: string; user: AdminMe }>('/auth/admin/totp/verify', { mfaToken, code });
        signIn(r.accessToken, r.user);
        navigate('/', { replace: true });
      }
    } catch (e) {
      setError(errorText(e));
      if (step === 'totp') setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-gradient px-4 py-12">
      <div className="w-full max-w-md animate-fade-up rounded-[24px] bg-white p-8 shadow-lift">
        <Logo />
        <h1 className="mt-8 font-display text-2xl font-extrabold text-navy">{step === 'password' ? 'Team sign in' : 'Two-step verification'}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {step === 'password' ? 'Bluenova team members only.' : 'Enter the 6-digit code from your authenticator app.'}
        </p>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="mt-6 space-y-5" noValidate>
          {step === 'password' ? (
            <>
              <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="username" icon={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
              <Field label="Password">{(id) => <PasswordInput id={id} autoComplete="current-password" icon={<Lock />} value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
            </>
          ) : (
            <Field label="Authenticator code">
              {(id) => <Input id={id} inputMode="numeric" maxLength={6} autoComplete="one-time-code" autoFocus icon={<ShieldCheck />}
                className="text-center font-mono text-2xl tracking-[0.5em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />}
            </Field>
          )}
          {error && <Alert tone="red">{error}</Alert>}
          <Button type="submit" block size="lg" loading={busy} disabled={step === 'password' ? !email || !password : code.length !== 6}>
            {step === 'password' ? 'Continue' : 'Verify & sign in'}
          </Button>
          {step === 'totp' && <button type="button" className="w-full text-sm font-semibold text-primary" onClick={() => { setStep('password'); setCode(''); }}>Start over</button>}
        </form>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const { me, signOut } = useAdmin();
  const { paymentsEnabled } = useFeatures();
  const navigate = useNavigate();
  const items = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, show: true, end: true },
    { to: '/creators', label: 'Creators', icon: Users, show: can(me, 'reviewer', 'campaign_manager') },
    { to: '/campaigns', label: 'Campaigns', icon: Megaphone, show: can(me, 'campaign_manager') },
    { to: '/payments', label: 'Payments', icon: Wallet, show: paymentsEnabled && can(me, 'finance', 'campaign_manager') },
    { to: '/users', label: 'Users', icon: Contact, show: me?.adminRole === 'super_admin' },
    { to: '/audit-logs', label: 'Audit log', icon: FileClock, show: me?.adminRole === 'super_admin' },
    { to: '/settings', label: 'Settings', icon: Settings, show: true },
  ].filter((i) => i.show);
  const logout = async () => { await signOut(); navigate('/login'); };
  return (
    <div className="min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy px-4 py-5 text-white lg:flex">
        <Logo light />
        <nav className="mt-8 flex-1">
          <ul className="space-y-1">
            {items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className={({ isActive }) => cx('flex items-center gap-3 rounded-ctl px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-white text-navy' : 'text-primary-100 hover:bg-white/10')}>
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />{label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="rounded-card bg-white/10 p-3">
          <div className="flex items-center gap-3">
            <Avatar name={me?.name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{me?.name}</p>
              <p className="truncate text-xs capitalize text-primary-200">{me?.adminRole.replace('_', ' ')}</p>
            </div>
          </div>
          <button type="button" onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-primary-100 hover:bg-white/10"><LogOut className="h-4 w-4" />Log out</button>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Logo />
            <button type="button" onClick={logout} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-bg" aria-label="Log out"><LogOut className="h-5 w-5" /></button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-4 pb-2">
            {items.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold', isActive ? 'bg-primary text-white' : 'text-ink-muted')}>{label}</NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl animate-fade-up px-4 py-6 sm:px-6 sm:py-8"><Outlet /></main>
      </div>
    </div>
  );
}

