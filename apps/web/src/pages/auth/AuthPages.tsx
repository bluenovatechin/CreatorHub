import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Clapperboard, KeyRound, Lock, Mail, MailCheck, User } from 'lucide-react';
import { emailOnlySchema, loginSchema, resetPasswordSchema, signupSchema, z, type SignupInput } from '../../lib/zod';
import { Alert, Button, Checkbox, ChoiceCards, Field, Input, PasswordInput, PasswordStrength, Spinner } from '@bluenova/ui';
import { ApiError, api, applyServerErrors, errorText, type Me } from '../../lib/api';
import { postLoginPath, useAuth } from '../../lib/auth';
import { AuthLayout } from '../../components/layout';
import { useFieldError } from '../../components/common';

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

/* ---------- Log in ---------- */

export function LoginPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const fe = useFieldError();
  const [error, setError] = useState<{ text: string; tone: 'red' | 'amber' } | null>(
    (location.state as { resetDone?: boolean } | null)?.resetDone ? { text: t('auth.resetDone'), tone: 'amber' } : null,
  );
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (v: z.infer<typeof loginSchema>) => {
    setError(null);
    try {
      const res = await api.post<{ accessToken: string; user: Me }>('/auth/login', v);
      signIn(res.accessToken, res.user);
      navigate(postLoginPath(res.user, params.get('next')), { replace: true });
    } catch (e) {
      const notVerified = e instanceof ApiError && e.message === 'errors.emailNotVerified';
      setError({ text: errorText(t, e), tone: notVerified ? 'amber' : 'red' });
    }
  };

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
  const navigate = useNavigate();
  const fe = useFieldError();
  const labels = usePasswordLabels();
  const [error, setError] = useState<string | null>(null);
  const initialRole = params.get('role') === 'brand' ? 'brand' : params.get('role') === 'creator' ? 'creator' : undefined;
  const { register, handleSubmit, watch, setValue, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: initialRole } as Partial<SignupInput>,
  });
  const role = watch('role');
  const password = watch('password') ?? '';

  const onSubmit = async (v: SignupInput) => {
    setError(null);
    try {
      await api.post('/auth/signup', v);
      navigate('/check-email', { state: { email: v.email } });
    } catch (e) {
      if (!applyServerErrors(e, setFieldError)) setError(errorText(t, e));
    }
  };

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
      <p className="mt-8 text-center text-sm text-ink-muted">
        {t('auth.haveAccount')} <Link to="/login" className="font-semibold text-primary hover:underline">{t('auth.login')}</Link>
      </p>
    </AuthLayout>
  );
}

/* ---------- Check your email ---------- */

export function CheckEmailPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? '';
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
  const resend = async () => {
    if (!email) return;
    setState('busy');
    await api.post('/auth/verify-email/resend', { email }).catch(() => undefined);
    setState('sent');
  };
  return (
    <AuthLayout>
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary"><MailCheck className="h-8 w-8" aria-hidden="true" /></span>
        <h1 className="mt-6 font-display text-3xl font-extrabold text-navy">{t('auth.checkTitle')}</h1>
        <p className="mt-3 text-ink-muted">{t('auth.checkText', { email: email || '…' })}</p>
        <p className="mt-6 text-sm text-ink-muted">{t('auth.checkHint')}</p>
        <div className="mt-6 flex flex-col gap-3">
          {email && (state === 'sent'
            ? <Alert tone="green">{t('auth.resent')}</Alert>
            : <Button variant="secondary" loading={state === 'busy'} onClick={resend}>{t('auth.resend')}</Button>)}
          <Link to="/login" className="text-sm font-semibold text-primary hover:underline">{t('auth.backToLogin')}</Link>
        </div>
      </div>
    </AuthLayout>
  );
}

/* ---------- Verify email (from the link) ---------- */

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const token = useHashToken();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (started.current) return; // links are single-use: never send twice
    started.current = true;
    if (!token) { setFailed(true); return; }
    api.post<{ accessToken: string; user: Me }>('/auth/verify-email', { token })
      .then((res) => { signIn(res.accessToken, res.user); navigate(postLoginPath(res.user, null), { replace: true }); })
      .catch(() => setFailed(true));
  }, [token, signIn, navigate]);

  return (
    <AuthLayout>
      <div className="text-center">
        {failed ? (
          <>
            <h1 className="font-display text-2xl font-extrabold text-navy">{t('auth.verifyFail')}</h1>
            <p className="mt-2 text-ink-muted">{t('auth.verifyFailText')}</p>
            <Link to="/login" className="mt-6 inline-flex min-h-12 items-center rounded-ctl bg-primary px-6 font-semibold text-white">{t('auth.login')}</Link>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 text-ink-muted"><Spinner className="h-8 w-8 text-primary" />{t('auth.verifying')}</div>
        )}
      </div>
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

/* ---------- Role choice (only for older accounts without a role) ---------- */

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
