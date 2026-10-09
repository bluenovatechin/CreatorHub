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

/* ---------- Continue with Google ---------- */

interface GoogleIdApi {
  accounts: { id: {
    initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup'; use_fedcm_for_prompt?: boolean }) => void;
    renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
  } };
}
declare global { interface Window { google?: GoogleIdApi } }

let gsiLoading: Promise<void> | null = null;
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  gsiLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gsiLoading = null; reject(new Error('Google script failed to load')); };
    document.head.appendChild(s);
  });
  return gsiLoading;
}

/**
 * Google's own button. `beforeSignIn` can block (e.g. role not chosen yet) by returning an error message.
 * Google proves the email is real, so these accounts skip the email code.
 */
function GoogleButton({ role, beforeSignIn }: { role?: 'creator' | 'brand'; beforeSignIn?: () => string | null }) {
  const { t, i18n } = useTranslation();
  const { googleClientId } = useAppConfig();
  const finish = useFinishLogin();
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef({ role, beforeSignIn });
  latest.current = { role, beforeSignIn };
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!googleClientId || !ref.current) return;
    let cancelled = false;
    loadGoogleScript().then(() => {
      if (cancelled || !ref.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        ux_mode: 'popup',
        callback: async ({ credential }) => {
          const blocked = latest.current.beforeSignIn?.();
          if (blocked) { setError(blocked); return; }
          setError(null);
          try {
            finish(await api.post<Session>('/auth/google', { credential, role: latest.current.role }));
          } catch (e) {
            setError(errorText(t, e));
          }
        },
      });
      ref.current.innerHTML = '';
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 360, locale: i18n.language === 'gu' ? 'gu' : 'en',
      });
    }).catch(() => setError(t('errors.googleFailed')));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleClientId, i18n.language]);

  if (!googleClientId) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
        <span className="h-px flex-1 bg-line" />{t('auth.or')}<span className="h-px flex-1 bg-line" />
      </div>
      <div ref={ref} className="flex justify-center" />
      {error && <Alert tone="red">{error}</Alert>}
    </div>
  );
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
      <div className="mt-6">
        <GoogleButton />
        <p className="mt-3 text-center text-xs text-ink-muted">{t('auth.googleTerms')}</p>
      </div>
      <p className="mt-8 text-center text-sm text-ink-muted">
        {t('auth.noAccount')} <Link to="/signup" className="font-semibold text-primary hover:underline">{t('auth.createAccount')}</Link>
      </p>
    </AuthLayout>
  );
}

/* ---------- Sign up ---------- */

export function SignupPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const finish = useFinishLogin();
  const fe = useFieldError();
  const labels = usePasswordLabels();
  const [error, setError] = useState<string | null>(null);
  const [verify, setVerify] = useState<{ ticket: string; email: string } | null>(null);
  const initialRole = params.get('role') === 'brand' ? 'brand' : params.get('role') === 'creator' ? 'creator' : undefined;
  const { register, handleSubmit, watch, setValue, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: initialRole } as Partial<SignupInput>,
  });
  const role = watch('role');
  const acceptTerms = watch('acceptTerms');
  const password = watch('password') ?? '';

  const onSubmit = async (v: SignupInput) => {
    setError(null);
    try {
      const r = await api.post<Partial<Session> & { otpSent?: boolean; ticket?: string }>('/auth/signup', v);
      if (r.accessToken && r.user) finish(r as Session); // test mode: verified straight away
      else if (r.ticket) setVerify({ ticket: r.ticket, email: v.email });
    } catch (e) {
      if (!applyServerErrors(e, setFieldError)) setError(errorText(t, e));
    }
  };

  if (verify) return <AuthLayout><OtpStep ticket={verify.ticket} email={verify.email} onBack={() => setVerify(null)} /></AuthLayout>;

  return (
    <AuthLayout>
      <Heading title={t('auth.signupTitle')} text={t('auth.signupSubtitle')} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="space-y-2">
          <p id="role-label" className="text-sm font-semibold text-ink">{t('auth.iAm')}</p>
          <ChoiceCards labelledBy="role-label" value={role} onChange={(v) => setValue('role', v, { shouldValidate: true })} options={[
            { value: 'creator', title: t('auth.roleCreator'), text: t('auth.roleCreatorText'), icon: <Clapperboard className="h-5 w-5" /> },
            { value: 'brand', title: t('auth.roleBrand'), text: t('auth.roleBrandText'), icon: <Building2 className="h-5 w-5" /> },
          ]} />
          {errors.role && <p role="alert" className="text-xs font-medium text-danger">{fe(errors.role.message)}</p>}
        </div>
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
      <div className="mt-6">
        <GoogleButton role={role} beforeSignIn={() => (!role ? t('errors.roleRequired') : !acceptTerms ? t('errors.consentRequired') : null)} />
      </div>
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

/* ---------- Role choice (Google sign-ups and older accounts without a role) ---------- */

export function RoleSelectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { me, reloadMe } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me?.role) navigate(`/${me.role}`, { replace: true });
  }, [me, navigate]);

  const choose = async (role: 'creator' | 'brand') => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/role', { role });
      const fresh = await reloadMe();
      if (fresh) navigate(postLoginPath(fresh, null), { replace: true });
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <Heading title={t('auth.roleTitle')} text={t('auth.roleNote')} />
      <ChoiceCards value={undefined} onChange={(v) => { if (!busy) void choose(v); }} options={[
        { value: 'creator' as const, title: t('auth.roleCreator'), text: t('auth.roleCreatorText'), icon: <Clapperboard className="h-5 w-5" /> },
        { value: 'brand' as const, title: t('auth.roleBrand'), text: t('auth.roleBrandText'), icon: <Building2 className="h-5 w-5" /> },
      ]} />
      {error && <div className="mt-4"><Alert tone="red">{error}</Alert></div>}
    </AuthLayout>
  );
}
