/**
 * LOGIN PAGE (/login)
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { loginSchema, type z } from '../../../lib/zod';
import { Alert, Button, Field, Input, PasswordInput } from '@bluenova/ui';
import { api, errorText } from '../../../lib/api';
import { AuthLayout } from '../../../components/layout';
import { useFieldError } from '../../../components/common';
import {
  Heading, GoogleButton, OtpStep, ServerWakeNotice, useFinishLogin, type Session,
} from '../components/AuthCommon';
import './LoginPage.css';

export function LoginPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const finish = useFinishLogin();
  const fe = useFieldError();
  const [verify, setVerify] = useState<{ ticket: string; email: string } | null>(null);
  const [error, setError] = useState<{ text: string; tone: 'red' | 'amber' | 'green' } | null>(
    (location.state as { resetDone?: boolean } | null)?.resetDone ? { text: t('auth.resetDone'), tone: 'amber' } : null,
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

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

  if (verify) {
    return (
      <div className="login-page">
        <AuthLayout>
          <OtpStep ticket={verify.ticket} email={verify.email} onBack={() => setVerify(null)} />
        </AuthLayout>
      </div>
    );
  }

  return (
    <div className="login-page">
      <AuthLayout>
        <Heading title={t('auth.loginTitle')} text={t('auth.loginSubtitle')} />
        <ServerWakeNotice />
        <div className="mb-5">
          <GoogleButton />
          <p className="mt-1.5 text-center text-xs text-ink-muted">
            {t('terms.googleNotice')} <Link to="/terms" target="_blank" className="font-semibold text-primary">{t('legal.terms')}</Link>
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <Field label={t('auth.email')} error={fe(errors.email?.message)}>
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
          <Field
            label={t('auth.password')}
            error={fe(errors.password?.message)}
            action={
              <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
                {t('auth.forgot')}
              </Link>
            }
          >
            {(id, d) => (
              <PasswordInput
                id={id}
                aria-describedby={d}
                autoComplete="current-password"
                icon={<Lock />}
                placeholder={t('auth.passwordPh')}
                showLabel={t('common.showPassword')}
                hideLabel={t('common.hidePassword')}
                invalid={!!errors.password}
                {...register('password')}
              />
            )}
          </Field>
          {error && <Alert tone={error.tone}>{error.text}</Alert>}
          <Button type="submit" block size="lg" loading={isSubmitting}>
            {t('auth.login')}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-ink-muted">{t('auth.googleTerms')}</p>
        <p className="mt-6 text-center text-sm text-ink-muted">
          {t('auth.noAccount')}{' '}
          <Link to="/signup" className="font-semibold text-primary hover:underline">
            {t('auth.createAccount')}
          </Link>
        </p>
      </AuthLayout>
    </div>
  );
}
