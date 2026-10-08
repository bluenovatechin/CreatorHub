import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Globe, KeyRound, Lock, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { changePasswordSchema, z } from '../../lib/zod';
import { Alert, Avatar, Button, Card, CardHeader, EmptyState, Field, PageHeader, PasswordInput, PasswordStrength, cx } from '@bluenova/ui';
import { api, applyServerErrors, errorText } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDateTime } from '../../lib/format';
import type { NotificationView } from '../../lib/types';
import { LanguageSwitch } from '../../components/layout';
import { QueryState, SafetyTip, useFieldError } from '../../components/common';

export function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications', 'list'], queryFn: () => api.getWithMeta<NotificationView[]>('/notifications') });
  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read', { all: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const items = q.data?.data ?? [];
  const unread = Number(q.data?.meta?.unread ?? 0);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('notifications.title')} subtitle={unread ? t('notifications.unread', { n: unread }) : undefined}
        action={unread > 0 && <Button variant="secondary" size="sm" loading={markAll.isPending} onClick={() => markAll.mutate()}>{t('notifications.markAll')}</Button>} />
      {q.isLoading || q.error ? <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} /> : items.length === 0 ? (
        <EmptyState icon={<Bell />} title={t('notifications.none')} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">
          {items.map((n) => {
            const text = t(`notif.${n.type}`, { ...n.params, defaultValue: t('notif.default') });
            const body = (
              <div className={cx('flex gap-4 px-5 py-4', !n.readAt && 'bg-primary-50/60')}>
                <span className={cx('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full', n.readAt ? 'bg-bg text-ink-faint' : 'bg-primary text-white')}><Bell className="h-4 w-4" aria-hidden="true" /></span>
                <div>
                  <p className={cx('text-sm', !n.readAt ? 'font-semibold text-navy' : 'text-ink')}>{text}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{formatDateTime(n.createdAt, i18n.language)}</p>
                </div>
              </div>
            );
            // Links are internal paths created by the server; never render anything else as a link.
            return <li key={n.id}>{n.link && n.link.startsWith('/') && !n.link.startsWith('//') ? <Link to={n.link} className="block hover:bg-bg">{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </div>
  );
}

function ChangePasswordCard() {
  const { t } = useTranslation();
  const fe = useFieldError();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  type Form = z.infer<typeof changePasswordSchema>;
  const { register, handleSubmit, watch, reset, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(changePasswordSchema) });
  const password = watch('password') ?? '';
  const labels = {
    length: t('auth.pwLength'), mix: t('auth.pwMix'), strength: t('auth.pwStrength'),
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
          {(id, d) => <PasswordInput id={id} aria-describedby={d} autoComplete="current-password" icon={<Lock />} showLabel={t('common.showPassword')} hideLabel={t('common.hidePassword')} invalid={!!errors.currentPassword} {...register('currentPassword')} />}
        </Field>
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
        {done && <Alert tone="green">{t('settings.passwordChanged')}</Alert>}
        {error && <Alert tone="red">{error}</Alert>}
        <Button type="submit" loading={isSubmitting}>{t('common.save')}</Button>
      </form>
    </Card>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { me, signOut } = useAuth();
  const navigate = useNavigate();
  const logoutAll = useMutation({
    mutationFn: () => api.post('/auth/logout-all'),
    onSettled: async () => { await signOut(); navigate('/'); },
  });
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={t('settings.title')} />
      <Card>
        <CardHeader icon={<UserRound />} title={t('settings.account')} />
        <div className="flex items-center gap-4">
          <Avatar name={me?.name} size="lg" />
          <div>
            <p className="font-display text-lg font-bold text-navy">{me?.name}</p>
            <p className="text-sm text-ink-muted">{me?.email}</p>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader icon={<Globe />} title={t('settings.language')} action={<LanguageSwitch />} />
      </Card>
      <ChangePasswordCard />
      <Card>
        <CardHeader icon={<ShieldCheck />} title={t('settings.security')} subtitle={t('settings.logoutAllText')} />
        <div className="flex flex-wrap gap-3">
          <Button variant="danger" loading={logoutAll.isPending} onClick={() => logoutAll.mutate()}>{t('settings.logoutAll')}</Button>
          <Button variant="secondary" icon={<LogOut className="h-4 w-4" />} onClick={async () => { await signOut(); navigate('/'); }}>{t('nav.logout')}</Button>
        </div>
      </Card>
      <SafetyTip kind="otp" />
    </div>
  );
}
