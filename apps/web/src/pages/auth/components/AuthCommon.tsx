import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MailCheck, ShieldCheck } from 'lucide-react';
import { Alert, Button, Field, Input } from '@bluenova/ui';
import { api, errorText, type Me } from '../../../lib/api';
import { postLoginPath, useAuth } from '../../../lib/auth';
import { useAppConfig } from '../../../lib/config';

export type Session = { accessToken: string; user: Me };

export function Heading({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-navy">{title}</h1>
      {text && <p className="mt-2 text-ink-muted">{text}</p>}
    </div>
  );
}

export function usePasswordLabels() {
  const { t } = useTranslation();
  return {
    length: t('auth.pwLength'),
    mix: t('auth.pwMix'),
    strength: t('auth.pwStrength'),
    levels: t('auth.pwLevels', { returnObjects: true }) as [string, string, string, string, string],
  };
}

/** Reads `#token=…` once, then removes it from the address bar (and browser history). */
export function useHashToken() {
  const [token] = useState(() => {
    const m = window.location.hash.match(/token=([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  });
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  }, []);
  return token;
}

/** Signs the user in and opens their dashboard (or the next onboarding step). */
export function useFinishLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signIn } = useAuth();
  return (s: Session) => {
    signIn(s.accessToken, s.user);
    navigate(postLoginPath(s.user, params.get('next')), { replace: true });
  };
}

/* ---------- Email code step (shown on the same page after signup, or on login if not yet verified) ---------- */

export function OtpStep({ ticket, email, onBack }: { ticket: string; email: string; onBack: () => void }) {
  const { t } = useTranslation();
  const finish = useFinishLogin();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const verify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError(t('errors.otp'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      finish(await api.post<Session>('/auth/signup/verify-otp', { ticket, code }));
    } catch (e) {
      setError(errorText(t, e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setResent(false);
    try {
      await api.post('/auth/signup/resend-otp', { ticket });
      setResent(true);
      setCooldown(60);
    } catch (e) {
      setError(errorText(t, e));
    }
  };

  return (
    <div className="animate-fade-up">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <MailCheck className="h-7 w-7" aria-hidden="true" />
      </span>
      <Heading title={t('auth.otpTitle')} text={t('auth.otpText', { email })} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
        noValidate
        className="space-y-5"
      >
        <Field label={t('auth.otpLabel')}>
          {(id) => (
            <Input
              id={id}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              icon={<ShieldCheck />}
              className="text-center font-mono text-2xl tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          )}
        </Field>
        {error && <Alert tone="red">{error}</Alert>}
        {resent && !error && <Alert tone="green">{t('auth.otpResent')}</Alert>}
        <Button type="submit" block size="lg" loading={busy} disabled={code.length !== 6}>
          {t('auth.otpVerify')}
        </Button>
      </form>
      <div className="mt-5 flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="font-semibold text-primary hover:underline">
          {t('auth.changeEmail')}
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="font-semibold text-primary hover:underline disabled:text-ink-faint disabled:no-underline"
        >
          {cooldown > 0 ? t('auth.otpResendIn', { s: cooldown }) : t('auth.otpResend')}
        </button>
      </div>
      <p className="mt-6 text-xs text-ink-muted">{t('auth.otpSpam')}</p>
    </div>
  );
}

/* ---------- Continue with Google ---------- */

export const GOOGLE_STATE_KEY = 'bn_google_signin';

export const googleRedirectUri = () => `${window.location.origin}/auth/google/callback`;

function randomValue(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function GoogleButton() {
  const { t } = useTranslation();
  const { googleClientId, status } = useAppConfig();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = () => {
    setError(null);
    if (status === 'failed') return setError(t('errors.serverDown'));
    if (status === 'loading') return setError(t('auth.googleLoading'));
    if (!googleClientId) return setError(t('errors.googleNotConfigured'));
    const state = randomValue();
    const nonce = randomValue();
    try {
      sessionStorage.setItem(GOOGLE_STATE_KEY, JSON.stringify({ state, nonce, next: params.get('next') }));
    } catch {
      return setError(t('errors.googleFailed'));
    }
    setBusy(true);
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: googleRedirectUri(),
      response_type: 'id_token',
      scope: 'openid email profile',
      prompt: 'select_account',
      state,
      nonce,
    }).toString();
    window.location.assign(url.toString());
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="flex min-h-11 w-full items-center justify-center gap-3 rounded-ctl border border-line-strong bg-white px-4 text-sm font-semibold text-ink hover:bg-bg disabled:opacity-60"
      >
        <GoogleLogo />
        {t('auth.continueGoogle')}
      </button>
      {error && <Alert tone="red">{error}</Alert>}
      <div className="flex items-center gap-3 pt-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">
        <span className="h-px flex-1 bg-line" />
        {t('auth.orEmail')}
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

export function ServerWakeNotice() {
  const { t } = useTranslation();
  const { status } = useAppConfig();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(id);
  }, []);
  if (status !== 'loading' || !slow) return null;
  return (
    <div className="mb-5">
      <Alert tone="amber">{t('auth.serverWaking')}</Alert>
    </div>
  );
}
