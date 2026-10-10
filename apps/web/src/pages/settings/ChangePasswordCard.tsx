import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { KeyRound, Lock } from 'lucide-react';
import { changePasswordSchema, type z } from '../../lib/zod';
import { Alert, Button, Card, CardHeader, Field, PasswordInput, PasswordStrength } from '@bluenova/ui';
import { api, applyServerErrors, errorText } from '../../lib/api';
import { useFieldError } from '../../components/common';

export function ChangePasswordCard() {
  const { t } = useTranslation();
  const fe = useFieldError();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  type Form = z.infer<typeof changePasswordSchema>;
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(changePasswordSchema) });
  const password = watch('password') ?? '';
  const labels = {
    length: t('auth.pwLength'),
    mix: t('auth.pwMix'),
    strength: t('auth.pwStrength'),
    levels: t('auth.pwLevels', { returnObjects: true }) as [string, string, string, string, string],
  };

  const onSubmit = async (v: Form) => {
    setError(null);
    setDone(false);
    try {
      const r = await api.post<{ accessToken: string }>('/auth/password/change', v);
      api.setToken(r.accessToken);
      reset();
      setDone(true);
    } catch (e) {
      if (!applyServerErrors(e, setFieldError)) setError(errorText(t, e));
    }
  };

  return (
    <Card>
      <CardHeader icon={<KeyRound />} title={t('settings.passwordTitle')} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label={t('settings.currentPassword')} error={fe(errors.currentPassword?.message)} required>
          {(id, d) => (
            <PasswordInput
              id={id}
              aria-describedby={d}
              autoComplete="current-password"
              icon={<Lock />}
              showLabel={t('common.showPassword')}
              hideLabel={t('common.hidePassword')}
              invalid={!!errors.currentPassword}
              {...register('currentPassword')}
            />
          )}
        </Field>
        <Field label={t('settings.newPassword')} error={fe(errors.password?.message)} required>
          {(id, d) => (
            <>
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
            </>
          )}
        </Field>
        {error && <Alert tone="red">{error}</Alert>}
        {done && <Alert tone="green">{t('settings.passwordChanged')}</Alert>}
        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting}>
            {t('settings.updatePassword')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
