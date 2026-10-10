/**
 * SIGNUP PAGE (/signup)
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { KeyRound, Lock, Mail, User } from 'lucide-react';
import { signupSchema, type SignupInput } from '../../../lib/zod';
import { Alert, Button, Checkbox, Field, Input, PasswordInput, PasswordStrength } from '@bluenova/ui';
import { api, applyServerErrors, errorText } from '../../../lib/api';
import { AuthLayout } from '../../../components/layout';
import { TermsBox, useTermsRead } from '../../../components/TermsBox';
import { useFieldError } from '../../../components/common';
import {
  Heading, GoogleButton, OtpStep, ServerWakeNotice, useFinishLogin, usePasswordLabels, type Session,
} from '../components/AuthCommon';
import './SignupPage.css';

export function SignupPage() {
  const { t } = useTranslation();
  const finish = useFinishLogin();
  const fe = useFieldError();
  const labels = usePasswordLabels();
  const [error, setError] = useState<string | null>(null);
  const [verify, setVerify] = useState<{ ticket: string; email: string } | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  });
  const password = watch('password') ?? '';
  // Option 2 (email + password) needs the terms box read and ticked; Google (option 1) never waits for it.
  const accepted = watch('acceptTerms') === true;
  const terms = useTermsRead(); // the tick unlocks only after the terms box was scrolled to the end

  const onSubmit = async (v: SignupInput) => {
    setError(null);
    try {
      const r = await api.post<Partial<Session> & { otpSent?: boolean; ticket?: string }>('/auth/signup', v);
      if (r.accessToken && r.user) finish(r as Session);
      else if (r.ticket) setVerify({ ticket: r.ticket, email: v.email });
    } catch (e) {
      if (!applyServerErrors(e, setFieldError)) setError(errorText(t, e));
    }
  };

  if (verify) {
    return (
      <div className="signup-page">
        <AuthLayout>
          <OtpStep ticket={verify.ticket} email={verify.email} onBack={() => setVerify(null)} />
        </AuthLayout>
      </div>
    );
  }

  return (
    <div className="signup-page">
      <AuthLayout>
        <Heading title={t('auth.signupTitle')} text={t('auth.signupSubtitle')} />
        <ServerWakeNotice />
        <div className="mb-5">
          {/* Option 1: Google, always available. Accepting the terms is stated here (like the login page). */}
          <GoogleButton />
          <p className="mt-1.5 text-center text-xs text-ink-muted">
            {t('terms.googleNotice')} <Link to="/terms" target="_blank" className="font-semibold text-primary">{t('legal.terms')}</Link>
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <Field label={t('auth.name')} error={fe(errors.name?.message)} required>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                autoComplete="name"
                icon={<User />}
                placeholder={t('auth.namePh')}
                invalid={!!errors.name}
                {...register('name')}
              />
            )}
          </Field>
          <Field label={t('auth.email')} error={fe(errors.email?.message)} required>
            {(id, d) => (
              <Input
                id={id}
                aria-describedby={d}
                type="email"
                autoComplete="email"
                inputMode="email"
                icon={<Mail />}
                placeholder={t('auth.emailPh')}
                invalid={!!errors.email}
                {...register('email')}
              />
            )}
          </Field>
          <Field label={t('auth.password')} error={fe(errors.password?.message)} required>
            {(id, d) => (
              <div className="space-y-2.5">
                <PasswordInput
                  id={id}
                  aria-describedby={d}
                  autoComplete="new-password"
                  icon={<Lock />}
                  placeholder={t('auth.newPasswordPh')}
                  showLabel={t('common.showPassword')}
                  hideLabel={t('common.hidePassword')}
                  invalid={!!errors.password}
                  {...register('password')}
                />
                <PasswordStrength password={password} labels={labels} />
              </div>
            )}
          </Field>
          <Field label={t('auth.confirmPassword')} error={fe(errors.confirmPassword?.message)} required>
            {(id, d) => (
              <PasswordInput
                id={id}
                aria-describedby={d}
                autoComplete="new-password"
                icon={<KeyRound />}
                showLabel={t('common.showPassword')}
                hideLabel={t('common.hidePassword')}
                invalid={!!errors.confirmPassword}
                {...register('confirmPassword')}
              />
            )}
          </Field>
          <div className="space-y-2">
            <TermsBox part="signup" read={terms.read} onRead={terms.onRead} />
            <Checkbox
              disabled={!terms.read}
              {...register('acceptTerms')}
              label={
                <>
                  {t('auth.acceptTermsPre')}{' '}
                  <Link to="/terms" target="_blank" className="font-semibold text-primary hover:underline">
                    {t('legal.terms')}
                  </Link>{' '}
                  {t('auth.and')}{' '}
                  <Link to="/privacy" target="_blank" className="font-semibold text-primary hover:underline">
                    {t('legal.privacy')}
                  </Link>
                </>
              }
            />
            {errors.acceptTerms && (
              <p role="alert" className="mt-1 text-xs font-medium text-danger">
                {t('errors.consentRequired')}
              </p>
            )}
          </div>
          {error && <Alert tone="red">{error}</Alert>}
          <Button type="submit" block size="lg" loading={isSubmitting} disabled={!accepted}>
            {t('auth.signup')}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-ink-muted">{t('auth.googleTerms')}</p>
        <p className="mt-8 text-center text-sm text-ink-muted">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            {t('auth.login')}
          </Link>
        </p>
      </AuthLayout>
    </div>
  );
}
