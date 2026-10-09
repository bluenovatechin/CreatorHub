/**
 * ACCOUNT PAGES: /login, /signup (+ 6-digit email code step), Continue with Google, /forgot-password,
 * /reset-password, and /welcome/role ("What brings you to Bluenova?" — creator or brand, asked once after the first login).
 * Every flow with success/failure paths: docs/FLOWS.md → "Accounts & login".
 */
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Clapperboard, KeyRound, Lock, Mail, MailCheck, ShieldCheck, User } from 'lucide-react';
import { emailOnlySchema, loginSchema, resetPasswordSchema, signupSchema, z, type SignupInput } from '../../lib/zod';
import { Alert, Button, Checkbox, ChoiceCards, Field, Input, PasswordInput, PasswordStrength } from '@bluenova/ui';
import { api, applyServerErrors, errorText, type Me } from '../../lib/api';
import { postLoginPath, useAuth } from '../../lib/auth';
import { useAppConfig } from '../../lib/config';
import { AuthLayout } from '../../components/layout';
import { useFieldError } from '../../components/common';

type Session = { accessToken: string; user: Me };

function Heading({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-navy">{title}</h1>
      {text && <p className="mt-2 text-ink-muted">{text}</p>}
    </div>
  );
}

function usePasswordLabels() {
  const { t } = useTranslation();
  return {
    length: t('auth.pwLength'), mix: t('auth.pwMix'), strength: t('auth.pwStrength'),
    levels: t('auth.pwLevels', { returnObjects: true }) as [string, string, string, string, string],
  };
}

/** Reads `#token=…` once, then removes it from the address bar (and browser history). */
function useHashToken() {
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
function useFinishLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { signIn } = useAuth();
  return (s: Session) => {
    signIn(s.accessToken, s.user);
    navigate(postLoginPath(s.user, params.get('next')), { replace: true });
  };
}

/* ---------- Email code step (shown on the same page after signup, or on login if not yet verified) ---------- */

function OtpStep({ ticket, email, onBack }: { ticket: string; email: string; onBack: () => void }) {
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
    if (!/^\d{6}$/.test(code)) { setError(t('errors.otp')); return; }
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
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><MailCheck className="h-7 w-7" aria-hidden="true" /></span>
      <Heading title={t('auth.otpTitle')} text={t('auth.otpText', { email })} />
      <form onSubmit={(e) => { e.preventDefault(); void verify(); }} noValidate className="space-y-5">
        <Field label={t('auth.otpLabel')}>
          {(id) => (
            <Input id={id} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus icon={<ShieldCheck />}
              className="text-center font-mono text-2xl tracking-[0.5em]" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          )}
        </Field>
        {error && <Alert tone="red">{error}</Alert>}
        {resent && !error && <Alert tone="green">{t('auth.otpResent')}</Alert>}
        <Button type="submit" block size="lg" loading={busy} disabled={code.length !== 6}>{t('auth.otpVerify')}</Button>
      </form>
      <div className="mt-5 flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="font-semibold text-primary hover:underline">{t('auth.changeEmail')}</button>
        <button type="button" onClick={resend} disabled={cooldown > 0} className="font-semibold text-primary hover:underline disabled:text-ink-faint disabled:no-underline">
          {cooldown > 0 ? t('auth.otpResendIn', { s: cooldown }) : t('auth.otpResend')}
        </button>
      </div>
      <p className="mt-6 text-xs text-ink-muted">{t('auth.otpSpam')}</p>
    </div>
  );
}

/* ---------- Continue with Google (full-page redirect: no pop-up, so pop-up/ad blockers can't break it) ---------- */

const GOOGLE_STATE_KEY = 'bn_google_signin'; // sessionStorage: this tab only, removed as soon as Google sends the person back

/** Where Google sends the person back. Must be listed in Google Cloud → Clients → "Authorized redirect URIs". */
const googleRedirectUri = () => `${window.location.origin}/auth/google/callback`;

/** A random value nobody can guess (base64url). */
function randomValue(bytes = 32) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * "Continue with Google" (same button on /login and /signup).
 *
 * Flow: click → we remember a random `state` + `nonce` for this tab → the WHOLE PAGE goes to Google's sign-in
 * page → the person picks an account → Google sends them back to /auth/google/callback#id_token=…&state=…
 * → GoogleCallbackPage checks `state`, sends the token + nonce to POST /auth/google → logged in.
 * New accounts have no role yet, so they continue to /welcome/role ("creator or brand?").
 * (We don't use Google's pop-up button: pop-up blockers, ad-blockers and Brave Shields often stop it.)
 */
function GoogleButton() {
  const { t } = useTranslation();
  const { googleClientId, status } = useAppConfig();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = () => {
    setError(null);
    if (status === 'failed') return setError(t('errors.serverDown')); // our API is unreachable
    if (status === 'loading') return setError(t('auth.googleLoading'));
    if (!googleClientId) return setError(t('errors.googleNotConfigured')); // GOOGLE_CLIENT_ID not set on the API
    const state = randomValue();
    const nonce = randomValue();
    try {
      sessionStorage.setItem(GOOGLE_STATE_KEY, JSON.stringify({ state, nonce, next: params.get('next') }));
    } catch {
      return setError(t('errors.googleFailed')); // storage blocked (very strict privacy mode)
    }
    setBusy(true);
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: googleRedirectUri(),
      response_type: 'id_token', // Google returns a signed ID token (who you are); we never get your Google password
      scope: 'openid email profile',
      prompt: 'select_account',
      state, // proves the answer belongs to THIS click (stops someone else's sign-in being pushed into your tab)
      nonce, // put inside the token by Google; the API checks it (stops an old/stolen token being replayed)
    }).toString();
    window.location.assign(url.toString());
  };

  return (
    <div className="space-y-3">
      <button type="button" onClick={start} disabled={busy}
        className="flex min-h-11 w-full items-center justify-center gap-3 rounded-ctl border border-line-strong bg-white px-4 text-sm font-semibold text-ink hover:bg-bg disabled:opacity-60">
        <GoogleLogo />{t('auth.continueGoogle')}
      </button>
      {error && <Alert tone="red">{error}</Alert>}
      <div className="flex items-center gap-3 pt-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">
        <span className="h-px flex-1 bg-line" />{t('auth.orEmail')}<span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}

/** Google's multi-colour "G" (inline SVG: no extra request, works with our Content-Security-Policy). */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * /auth/google/callback: Google sends the person back here with #id_token=…&state=… (or #error=…).
 * The `#` part never reaches any server log. We check `state`, then POST /auth/google { credential, nonce }.
 * ✅ → logged in → their area (or /welcome/role for new accounts).  ❌ → message + "Back to log in".
 */
export function GoogleCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false); // React dev mode runs effects twice; the token must be used only once

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    window.history.replaceState(null, '', window.location.pathname); // remove the token from the address bar
    let saved: { state?: string; nonce?: string; next?: string | null } = {};
    try {
      saved = JSON.parse(sessionStorage.getItem(GOOGLE_STATE_KEY) ?? '{}');
      sessionStorage.removeItem(GOOGLE_STATE_KEY);
    } catch { /* storage blocked: handled below as an invalid state */ }

    const credential = hash.get('id_token');
    if (hash.get('error')) return setError(t(hash.get('error') === 'access_denied' ? 'errors.googleCancelled' : 'errors.googleFailed'));
    if (!credential || !saved.state || hash.get('state') !== saved.state || !saved.nonce) return setError(t('errors.googleFailed'));

    api.post<Session>('/auth/google', { credential, nonce: saved.nonce })
      .then((s) => {
        signIn(s.accessToken, s.user);
        navigate(postLoginPath(s.user, saved.next ?? null), { replace: true });
      })
      .catch((e) => setError(errorText(t, e)));
  }, [t, navigate, signIn]);

  return (
    <AuthLayout>
      {error ? (
        <>
          <Heading title={t('auth.googleProblemTitle')} />
          <Alert tone="red">{error}</Alert>
          <Link to="/login" replace className="mt-6 inline-block font-semibold text-primary hover:underline">{t('auth.backToLogin')}</Link>
        </>
      ) : (
        <Heading title={t('auth.googleSigningIn')} text={t('auth.pleaseWait')} />
      )}
    </AuthLayout>
  );
}

/**
 * Opening the login/signup page loads GET /config, which also WAKES the sleeping free server.
 * If that takes more than 3 seconds, tell the person what's happening (instead of a surprise error later).
 */
function ServerWakeNotice() {
  const { t } = useTranslation();
  const { status } = useAppConfig();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(id);
  }, []);
  if (status !== 'loading' || !slow) return null;
  return <div className="mb-5"><Alert tone="amber">{t('auth.serverWaking')}</Alert></div>;
}

/* ---------- Log in ---------- */

export function LoginPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const finish = useFinishLogin();
  const fe = useFieldError();
  const [verify, setVerify] = useState<{ ticket: string; email: string } | null>(null);
  const [error, setError] = useState<{ text: string; tone: 'red' | 'amber' | 'green' } | null>(
    (location.state as { resetDone?: boolean } | null)?.resetDone ? { text: t('auth.resetDone'), tone: 'amber' } : null,
  );
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (v: z.infer<typeof loginSchema>) => {
    setError(null);
    try {
      const r = await api.post<Session & { needsVerification?: boolean; ticket?: string; email?: string }>('/auth/login', v);
      if (r.needsVerification && r.ticket) setVerify({ ticket: r.ticket, email: r.email ?? v.email });
      else finish(r);
    } catch (e) {
      setError({ text: errorText(t, e), tone: 'red' });
    }
  };

  if (verify) return <AuthLayout><OtpStep ticket={verify.ticket} email={verify.email} onBack={() => setVerify(null)} /></AuthLayout>;

  return (
    <AuthLayout>
      <Heading title={t('auth.loginTitle')} text={t('auth.loginSubtitle')} />
      <ServerWakeNotice />
      <div className="mb-5"><GoogleButton /></div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label={t('auth.email')} error={fe(errors.email?.message)}>
          {(id, d) => <Input id={id} aria-describedby={d} type="email" autoComplete="email" inputMode="email" icon={<Mail />} placeholder={t('auth.emailPh')} invalid={!!errors.email} {...register('email')} />}
        </Field>
        <Field label={t('auth.password')} error={fe(errors.password?.message)}
          action={<Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">{t('auth.forgot')}</Link>}>
          {(id, d) => <PasswordInput id={id} aria-describedby={d} autoComplete="current-password" icon={<Lock />} placeholder={t('auth.passwordPh')}
            showLabel={t('common.showPassword')} hideLabel={t('common.hidePassword')} invalid={!!errors.password} {...register('password')} />}
        </Field>
        {error && <Alert tone={error.tone}>{error.text}</Alert>}
        <Button type="submit" block size="lg" loading={isSubmitting}>{t('auth.login')}</Button>
      </form>
      <p className="mt-4 text-center text-xs text-ink-muted">{t('auth.googleTerms')}</p>
      <p className="mt-6 text-center text-sm text-ink-muted">
        {t('auth.noAccount')} <Link to="/signup" className="font-semibold text-primary hover:underline">{t('auth.createAccount')}</Link>
      </p>
    </AuthLayout>
  );
}

/* ---------- Sign up ---------- */

/**
 * Sign up: name, email, password (+ accept terms). Nothing else.
 *
 * Flow: submit → POST /auth/signup → the API emails a 6-digit code and returns a `ticket` →
 * this same page swaps to <OtpStep> → correct code → logged in → /welcome/role ("creator or brand?").
 * Errors: field problems (e.g. weak password) appear under the field; anything else in the red box.
 */
export function SignupPage() {
  const { t } = useTranslation();
  const finish = useFinishLogin();
  const fe = useFieldError();
  const labels = usePasswordLabels();
  const [error, setError] = useState<string | null>(null);
  // Set after a successful submit: switches this page to the "enter the code" step.
  const [verify, setVerify] = useState<{ ticket: string; email: string } | null>(null);
  const { register, handleSubmit, watch, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema), // the same rules the API uses (packages/shared/src/schemas.ts)
  });
  const password = watch('password') ?? '';

  const onSubmit = async (v: SignupInput) => {
    setError(null);
    try {
      const r = await api.post<Partial<Session> & { otpSent?: boolean; ticket?: string }>('/auth/signup', v);
      if (r.accessToken && r.user) finish(r as Session); // TEST_MODE on the server: verified straight away
      else if (r.ticket) setVerify({ ticket: r.ticket, email: v.email });
    } catch (e) {
      if (!applyServerErrors(e, setFieldError)) setError(errorText(t, e));
    }
  };

  if (verify) return <AuthLayout><OtpStep ticket={verify.ticket} email={verify.email} onBack={() => setVerify(null)} /></AuthLayout>;

  return (
    <AuthLayout>
      <Heading title={t('auth.signupTitle')} text={t('auth.signupSubtitle')} />
      <ServerWakeNotice />
      <div className="mb-5"><GoogleButton /></div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label={t('auth.name')} error={fe(errors.name?.message)} required>
          {(id, d) => <Input id={id} aria-describedby={d} autoComplete="name" icon={<User />} placeholder={t('auth.namePh')} invalid={!!errors.name} {...register('name')} />}
        </Field>
        <Field label={t('auth.email')} error={fe(errors.email?.message)} required>
          {(id, d) => <Input id={id} aria-describedby={d} type="email" autoComplete="email" inputMode="email" icon={<Mail />} placeholder={t('auth.emailPh')} invalid={!!errors.email} {...register('email')} />}
        </Field>
        <Field label={t('auth.password')} error={fe(errors.password?.message)} required>
          {(id, d) => (
            <div className="space-y-2.5">
              <PasswordInput id={id} aria-describedby={d} autoComplete="new-password" icon={<Lock />} placeholder={t('auth.newPasswordPh')}
                showLabel={t('common.showPassword')} hideLabel={t('common.hidePassword')} invalid={!!errors.password} {...register('password')} />
              <PasswordStrength password={password} labels={labels} />
            </div>
          )}
        </Field>
        <Field label={t('auth.confirmPassword')} error={fe(errors.confirmPassword?.message)} required>
          {(id, d) => <PasswordInput id={id} aria-describedby={d} autoComplete="new-password" icon={<KeyRound />}
            showLabel={t('common.showPassword')} hideLabel={t('common.hidePassword')} invalid={!!errors.confirmPassword} {...register('confirmPassword')} />}
        </Field>
        <div>
          <Checkbox {...register('acceptTerms')} label={(
            <>
              {t('auth.acceptTermsPre')}{' '}
              <Link to="/terms" target="_blank" className="font-semibold text-primary hover:underline">{t('legal.terms')}</Link>{' '}
              {t('auth.and')}{' '}
              <Link to="/privacy" target="_blank" className="font-semibold text-primary hover:underline">{t('legal.privacy')}</Link>
            </>
          )} />
          {errors.acceptTerms && <p role="alert" className="mt-1 text-xs font-medium text-danger">{t('errors.consentRequired')}</p>}
        </div>
        {error && <Alert tone="red">{error}</Alert>}
        <Button type="submit" block size="lg" loading={isSubmitting}>{t('auth.signup')}</Button>
      </form>
      <p className="mt-4 text-center text-xs text-ink-muted">{t('auth.googleTerms')}</p>
      <p className="mt-8 text-center text-sm text-ink-muted">
        {t('auth.haveAccount')} <Link to="/login" className="font-semibold text-primary hover:underline">{t('auth.login')}</Link>
      </p>
    </AuthLayout>
  );
}

/* ---------- Forgot / reset password ---------- */

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const fe = useFieldError();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(emailOnlySchema) });
  const onSubmit = async ({ email }: { email: string }) => {
    setError(null);
    try {
      await api.post('/auth/password/forgot', { email });
      setSentTo(email);
    } catch (e) {
      setError(errorText(t, e));
    }
  };
  return (
    <AuthLayout>
      <Heading title={t('auth.forgotTitle')} text={t('auth.forgotText')} />
      {sentTo ? (
        <Alert tone="green">{t('auth.forgotSent', { email: sentTo })}</Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <Field label={t('auth.email')} error={fe(errors.email?.message)}>
            {(id, d) => <Input id={id} aria-describedby={d} type="email" autoComplete="email" icon={<Mail />} placeholder={t('auth.emailPh')} invalid={!!errors.email} {...register('email')} />}
          </Field>
          {error && <Alert tone="red">{error}</Alert>}
          <Button type="submit" block size="lg" loading={isSubmitting}>{t('auth.sendLink')}</Button>
        </form>
      )}
      <p className="mt-8 text-center"><Link to="/login" className="text-sm font-semibold text-primary hover:underline">{t('auth.backToLogin')}</Link></p>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fe = useFieldError();
  const labels = usePasswordLabels();
  const token = useHashToken();
  const [error, setError] = useState<string | null>(null);
  type Form = { password: string; confirmPassword: string };
  const formSchema = resetPasswordSchema.innerType().omit({ token: true }).refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'errors.passwordMismatch' });
  const { register, handleSubmit, watch, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(formSchema) });
  const password = watch('password') ?? '';

  if (!token) {
    return (
      <AuthLayout>
        <Heading title={t('auth.verifyFail')} />
        <Link to="/forgot-password" className="font-semibold text-primary hover:underline">{t('auth.forgotTitle')}</Link>
      </AuthLayout>
    );
  }

  const onSubmit = async (v: Form) => {
    setError(null);
    try {
      await api.post('/auth/password/reset', { token, ...v });
      navigate('/login', { replace: true, state: { resetDone: true } });
    } catch (e) {
      if (!applyServerErrors(e, setFieldError)) setError(errorText(t, e));
    }
  };

  return (
    <AuthLayout>
      <Heading title={t('auth.resetTitle')} text={t('auth.resetText')} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label={t('auth.newPassword')} error={fe(errors.password?.message)} required>
          {(id, d) => (
            <div className="space-y-2.5">
              <PasswordInput id={id} aria-describedby={d} autoComplete="new-password" icon={<Lock />} showLabel={t('common.showPassword')} hideLabel={t('common.hidePassword')} invalid={!!errors.password} {...register('password')} />
              <PasswordStrength password={password} labels={labels} />
            </div>
          )}
        </Field>
        <Field label={t('auth.confirmPassword')} error={fe(errors.confirmPassword?.message)} required>
          {(id, d) => <PasswordInput id={id} aria-describedby={d} autoComplete="new-password" icon={<KeyRound />} showLabel={t('common.showPassword')} hideLabel={t('common.hidePassword')} invalid={!!errors.confirmPassword} {...register('confirmPassword')} />}
        </Field>
        {error && <Alert tone="red">{error}</Alert>}
        <Button type="submit" block size="lg" loading={isSubmitting}>{t('auth.resetBtn')}</Button>
      </form>
    </AuthLayout>
  );
}

/* ---------- "What brings you to Bluenova?" (shown once, right after the first login) ---------- */

/**
 * Every new account (email or Google) lands here once, because it has no role yet.
 * Pick a card → Continue → POST /auth/role → the API creates the creator or brand profile →
 * we reload /me and go to that area's first step (creator onboarding, or brand profile).
 */
export function RoleSelectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { me, reloadMe } = useAuth();
  const [role, setRole] = useState<'creator' | 'brand' | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already chose before (e.g. pressed Back)? Go to their area instead.
  useEffect(() => {
    if (me?.role) navigate(postLoginPath(me, null), { replace: true });
  }, [me, navigate]);

  const submit = async () => {
    if (!role) { setError(t('errors.roleRequired')); return; }
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/role', { role });
      const fresh = await reloadMe(); // the useEffect above then navigates
      if (!fresh) setError(t('errors.generic'));
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <Heading title={t('auth.roleTitle')} text={t('auth.roleNote')} />
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-5">
        <ChoiceCards value={role} onChange={(v) => { setRole(v); setError(null); }} options={[
          { value: 'creator' as const, title: t('auth.roleCreator'), text: t('auth.roleCreatorText'), icon: <Clapperboard className="h-5 w-5" /> },
          { value: 'brand' as const, title: t('auth.roleBrand'), text: t('auth.roleBrandText'), icon: <Building2 className="h-5 w-5" /> },
        ]} />
        {error && <Alert tone="red">{error}</Alert>}
        <Button type="submit" block size="lg" loading={busy} disabled={!role}>{t('auth.roleContinue')}</Button>
      </form>
    </AuthLayout>
  );
}
