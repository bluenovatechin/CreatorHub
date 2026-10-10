/**
 * FORGOT PASSWORD PAGE (/forgot-password)
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { emailOnlySchema } from '../../../lib/zod';
import { Alert, Button, Field, Input } from '@bluenova/ui';
import { api, errorText } from '../../../lib/api';
import { AuthLayout } from '../../../components/layout';
import { useFieldError } from '../../../components/common';
import { Heading } from '../components/AuthCommon';
import './ForgotPasswordPage.css';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const fe = useFieldError();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({ resolver: zodResolver(emailOnlySchema) });

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
    <div className="forgot-password-page">
      <AuthLayout>
        <Heading title={t('auth.forgotTitle')} text={t('auth.forgotText')} />
        {sentTo ? (
          <Alert tone="green">{t('auth.forgotSent', { email: sentTo })}</Alert>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            <Field label={t('auth.email')} error={fe(errors.email?.message)}>
              {(id, d) => (
                <Input
                  id={id}
                  aria-describedby={d}
                  type="email"
                  autoComplete="email"
                  icon={<Mail />}
                  placeholder={t('auth.emailPh')}
                  invalid={!!errors.email}
                  {...register('email')}
                />
              )}
            </Field>
            {error && <Alert tone="red">{error}</Alert>}
            <Button type="submit" block size="lg" loading={isSubmitting}>
              {t('auth.sendLink')}
            </Button>
          </form>
        )}
        <p className="mt-8 text-center">
          <Link to="/login" className="text-sm font-semibold text-primary hover:underline">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </AuthLayout>
    </div>
  );
}
