/**
 * RESET PASSWORD PAGE (/reset-password)
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Lock } from 'lucide-react';
import { resetPasswordSchema } from '../../../lib/zod';
import { Alert, Button, Field, PasswordInput, PasswordStrength } from '@bluenova/ui';
import { api, applyServerErrors, errorText } from '../../../lib/api';
import { AuthLayout } from '../../../components/layout';
import { useFieldError } from '../../../components/common';
import { Heading, useHashToken, usePasswordLabels } from '../components/AuthCommon';
import './ResetPasswordPage.css';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fe = useFieldError();
  const labels = usePasswordLabels();
  const token = useHashToken();
  const [error, setError] = useState<string | null>(null);
  type Form = { password: string; confirmPassword: string };
  const formSchema = resetPasswordSchema
    .innerType()
    .omit({ token: true })
    .refine((v) => v.password === v.confirmPassword, {
      path: ['confirmPassword'],
      message: 'errors.passwordMismatch',
    });
  const {
    register,
    handleSubmit,
    watch,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(formSchema) });
  const password = watch('password') ?? '';

  if (!token) {
    return (
      <div className="reset-password-page">
        <AuthLayout>
          <Heading title={t('auth.verifyFail')} />
          <Link to="/forgot-password" className="font-semibold text-primary hover:underline">
            {t('auth.forgotTitle')}
          </Link>
        </AuthLayout>
      </div>
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
    <div className="reset-password-page">
      <AuthLayout>
        <Heading title={t('auth.resetTitle')} text={t('auth.resetText')} />
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <Field label={t('auth.newPassword')} error={fe(errors.password?.message)} required>
            {(id, d) => (
              <div className="space-y-2.5">
                <PasswordInput
                  id={id}
                  aria-describedby={d}
                  autoComplete="new-password"
                  icon={<Lock />}
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
          {error && <Alert tone="red">{error}</Alert>}
          <Button type="submit" block size="lg" loading={isSubmitting}>
            {t('auth.resetBtn')}
          </Button>
        </form>
      </AuthLayout>
    </div>
  );
}
