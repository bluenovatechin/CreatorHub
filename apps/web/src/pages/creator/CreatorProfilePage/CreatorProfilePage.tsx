/**
 * MY PROFILE (/creator/profile, approved creators): profile completeness, the locked identity fields, and a form to
 * keep the rest current: bio, languages, best reels, self-reported stats, rate card, barter, availability.
 * Rules are the shared creatorPartnerUpdateSchema (same as the API); server errors appear under each field.
 * Name, Instagram handle, city and categories need the team (Messages). API: PUT /creators/me/profile.
 */
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { BarChart3, CheckCircle2, Circle, Lock, UserRound } from 'lucide-react';
import { Alert, Button, Card, CardHeader, Checkbox, ChipSelect, Field, Input, PageHeader, SearchMultiSelect, Textarea, cx } from '@bluenova/ui';
import { DELIVERABLE_TYPES, LANGUAGES, creatorPartnerUpdateSchema } from '../../../lib/zod';
import { api, applyServerErrors, errorText } from '../../../lib/api';
import { categoryLabel, cityLabel, cityOptions } from '../../../lib/format';
import type { CreatorSelf } from '../../../lib/types';
import { QueryState, useFieldError } from '../../../components/common';
import { useProfile } from '../components/CreatorCommon';

interface Form {
  bio: string; areas: string[]; languages: string[]; r1: string; r2: string; r3: string; available: boolean;
  followers: string; avgViews: string; engagementRate: string; acceptsBarter: boolean; rate: Record<string, string>;
}

/** What a strong profile has; each missing item is a hint (no invented numbers, just what's filled in). */
export function profileChecklist(p: CreatorSelf) {
  return [
    { key: 'bio', done: !!p.bio?.trim() },
    { key: 'reels3', done: p.reels.length >= 3 },
    { key: 'languages', done: p.languages.length >= 2 },
    { key: 'areas', done: (p.areas ?? []).length > 0 },
    { key: 'rates', done: Object.keys(p.rateCardPaise ?? {}).length >= 2 || p.acceptsBarter },
    { key: 'stats', done: p.stats.followers != null && p.stats.engagementRate != null },
    { key: 'details', done: !!p.gender && !!p.ageGroup },
  ];
}

export function CompletenessMeter({ p, compact = false }: { p: CreatorSelf; compact?: boolean }) {
  const { t } = useTranslation();
  const items = profileChecklist(p);
  const pct = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-sm font-semibold"><span>{t('profile.complete')}</span><span>{pct}%</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      {!compact && (
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {items.map((i) => (
            <li key={i.key} className={cx('flex items-center gap-2', i.done ? 'text-ink-muted' : 'text-navy')}>
              {i.done ? <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden="true" /> : <Circle className="h-4 w-4 text-line-strong" aria-hidden="true" />}
              {t(`profile.items.${i.key}`)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProfileForm({ p }: { p: CreatorSelf }) {
  const { t, i18n } = useTranslation();
  const fe = useFieldError();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { register, control, handleSubmit, setError: setFieldError, formState: { errors } } = useForm<Form>({
    defaultValues: {
      bio: p.bio ?? '', areas: p.areas ?? [], languages: p.languages, r1: p.reels[0] ?? '', r2: p.reels[1] ?? '', r3: p.reels[2] ?? '',
      available: p.availability?.open !== false, followers: String(p.stats.followers ?? ''), avgViews: String(p.stats.avgViews ?? ''),
      engagementRate: String(p.stats.engagementRate ?? ''), acceptsBarter: p.acceptsBarter,
      rate: Object.fromEntries(DELIVERABLE_TYPES.map((d) => [d, p.rateCardPaise[d] !== undefined ? String(p.rateCardPaise[d] / 100) : ''])),
    },
  });
  const save = useMutation({
    mutationFn: (body: unknown) => api.put<CreatorSelf>('/creators/me/profile', body),
    onSuccess: (fresh) => { qc.setQueryData(['creator', 'me'], fresh); setSaved(true); },
  });
  const onSubmit = async (v: Form) => {
    setError(null);
    setSaved(false);
    const body = {
      bio: v.bio, areas: v.areas, languages: v.languages, reels: [v.r1, v.r2, v.r3].map((x) => x.trim()).filter(Boolean), available: v.available,
      followers: v.followers, avgViews: v.avgViews, engagementRate: v.engagementRate, acceptsBarter: v.acceptsBarter,
      rateCard: Object.fromEntries(Object.entries(v.rate).filter(([, x]) => x.trim() !== '').map(([k, x]) => [k, Number(x)])),
    };
    // Same rules as the server, checked here first for instant messages.
    const parsed = creatorPartnerUpdateSchema.safeParse(body);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === 'reels' ? 'r1' : issue.path[0] === 'rateCard' ? 'rate' : String(issue.path[0] ?? 'bio');
        setFieldError(key as keyof Form, { message: issue.message });
      }
      return;
    }
    try {
      await save.mutateAsync(body);
    } catch (e) {
      if (!applyServerErrors(e, setFieldError)) setError(errorText(t, e));
    }
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <Card>
        <CardHeader icon={<UserRound />} title={t('profile.about')} />
        <div className="space-y-4">
          <Field label={t('onboarding.bio')} error={fe(errors.bio?.message)}>{(id) => <Textarea id={id} rows={3} maxLength={300} {...register('bio')} />}</Field>
          <Field label={t('onboarding.areas')} hint={t('onboarding.areasHint')} error={fe(errors.areas?.message)}>
            {(id) => (
              <Controller control={control} name="areas" render={({ field }) => (
                <SearchMultiSelect id={id} options={cityOptions(i18n.language)} value={field.value} onChange={field.onChange} max={30}
                  placeholder={t('common.typeCity')} empty={t('common.noCity')} removeLabel={t('common.remove')} />
              )} />
            )}
          </Field>
          <div className="space-y-1.5">
            <p id="langs" className="text-sm font-medium">{t('onboarding.languages')}</p>
            <Controller control={control} name="languages" render={({ field }) => (
              <ChipSelect labelledBy="langs" value={field.value} onChange={field.onChange} max={3} options={LANGUAGES.map((l) => ({ value: l, label: t(`lang.${l}`) }))} />
            )} />
            {errors.languages && <p className="text-xs font-medium text-danger">{fe(errors.languages.message)}</p>}
          </div>
          {(['r1', 'r2', 'r3'] as const).map((k, n) => (
            <Field key={k} label={t('onboarding.reelN', { n: n + 1 })} error={k === 'r1' ? fe(errors.r1?.message) : undefined}>
              {(id) => <Input id={id} type="url" placeholder="https://www.instagram.com/reel/…" {...register(k)} />}
            </Field>
          ))}
          <Controller control={control} name="available" render={({ field }) => (
            <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} label={t('profile.available')} />
          )} />
        </div>
      </Card>
      <Card>
        <CardHeader icon={<BarChart3 />} title={t('onboarding.s4Title')} subtitle={t('common.selfReported')} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('onboarding.followers')} error={fe(errors.followers?.message)}>{(id) => <Input id={id} inputMode="numeric" {...register('followers')} />}</Field>
          <Field label={t('onboarding.avgViews')} error={fe(errors.avgViews?.message)}>{(id) => <Input id={id} inputMode="numeric" {...register('avgViews')} />}</Field>
          <Field label={t('onboarding.engagement')} error={fe(errors.engagementRate?.message)}>{(id) => <Input id={id} inputMode="decimal" {...register('engagementRate')} />}</Field>
        </div>
        <p className="mt-5 text-sm font-medium">{t('onboarding.rateCard')}</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {DELIVERABLE_TYPES.map((d) => (
            <Field key={d} label={t(`deliverable.${d}`)}>{(id) => <Input id={id} inputMode="numeric" placeholder="₹" {...register(`rate.${d}`)} />}</Field>
          ))}
        </div>
        {errors.rate && <p className="mt-2 text-xs font-medium text-danger">{fe((errors.rate as { message?: string }).message)}</p>}
        <div className="mt-4">
          <Controller control={control} name="acceptsBarter" render={({ field }) => (
            <Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} label={t('onboarding.barter')} />
          )} />
        </div>
      </Card>
      {error && <Alert tone="red">{error}</Alert>}
      {saved && <Alert tone="green">{t('settings.saved')}</Alert>}
      <Button type="submit" loading={save.isPending}>{t('profile.save')}</Button>
    </form>
  );
}

export function CreatorProfilePage() {
  const { t, i18n } = useTranslation();
  const profile = useProfile();
  if (profile.isLoading || profile.error) return <QueryState isLoading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} />;
  const p = profile.data!;
  if (p.status !== 'APPROVED') return <Navigate to="/creator/status" replace />;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />
      <Card><CompletenessMeter p={p} /></Card>
      <Card>
        <CardHeader icon={<Lock />} title={t('profile.locked')} subtitle={t('profile.lockedText')} />
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-muted">{t('onboarding.displayName')}</dt><dd className="font-semibold">{p.displayName}</dd></div>
          <div><dt className="text-ink-muted">Instagram</dt><dd className="font-semibold">@{p.igHandle}</dd></div>
          <div><dt className="text-ink-muted">{t('onboarding.city')}</dt><dd className="font-semibold">{p.city ? cityLabel(p.city, i18n.language) : '—'}</dd></div>
          <div><dt className="text-ink-muted">{t('onboarding.s2Title')}</dt><dd className="font-semibold">{p.categories.map((c) => categoryLabel(c, i18n.language)).join(', ')}</dd></div>
        </dl>
        <Link to="/creator/messages?new=1&subject=Profile%20change" className="mt-4 inline-block text-sm font-semibold text-primary">{t('profile.askTeam')}</Link>
      </Card>
      <ProfileForm p={p} />
    </div>
  );
}
