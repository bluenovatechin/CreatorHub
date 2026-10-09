/**
 * CREATOR ONBOARDING (/creator/onboarding/1..5): 4 forms (about you, categories, sample reels, stats & rates)
 * saved one by one (PUT /creators/me/onboarding/:step), then step 5 = review & submit (POST /creators/me/submit).
 * After submit → /creator/status while the team reviews.
 */
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  AGE_GROUPS, CATEGORIES, CITIES, DELIVERABLE_TYPES, GENDERS, LANGUAGES,
  creatorStep1Schema, creatorStep2Schema, creatorStep3Schema, creatorStep4Schema,
  type CreatorStep1, type CreatorStep2, type CreatorStep4,
} from '../../lib/zod';
import { Alert, Button, Card, CardHeader, Checkbox, ChipSelect, Field, Input, PageHeader, Select, Stepper, Textarea } from '@bluenova/ui';
import { BarChart3, ClipboardCheck, Clapperboard, LayoutGrid, Phone, UserRound } from 'lucide-react';
import { CategoryIcon } from '../../components/icons';
import { api, applyServerErrors, errorText } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { categoryLabel, cityLabel, formatINR } from '../../lib/format';
import type { CreatorSelf } from '../../lib/types';
import { QueryState, useFieldError } from '../../components/common';

const optional = (v: unknown) => (v === '' || v === null ? undefined : v);
const optionalNumber = (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v));

function useProfile() {
  return useQuery({ queryKey: ['creator', 'me'], queryFn: () => api.get<CreatorSelf>('/creators/me') });
}

export function CreatorOnboarding() {
  const { t } = useTranslation();
  const { step: stepParam } = useParams();
  const step = Math.min(5, Math.max(1, Number(stepParam) || 1));
  const profile = useProfile();

  if (profile.isLoading || profile.error) return <QueryState isLoading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} />;
  const p = profile.data!;
  if (!['DRAFT', 'CHANGES_REQUESTED'].includes(p.status)) return <Navigate to="/creator/status" replace />;
  // Don't let people jump ahead of where they are; the server re-validates everything on submit anyway.
  if (step > p.onboardingStep) return <Navigate to={`/creator/onboarding/${p.onboardingStep}`} replace />;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('onboarding.title')} subtitle={t('onboarding.subtitle')} />
      <Stepper steps={t('onboarding.steps', { returnObjects: true }) as string[]} current={step} />
      {p.status === 'CHANGES_REQUESTED' && p.review?.reasonText && (
        <div className="mb-4"><Alert tone="amber" title={t('onboarding.changesBanner')}>{p.review.reasonText}</Alert></div>
      )}
      {step === 1 && <Step1 p={p} />}
      {step === 2 && <Step2 p={p} />}
      {step === 3 && <Step3 p={p} />}
      {step === 4 && <Step4 p={p} />}
      {step === 5 && <Step5 p={p} />}
    </div>
  );
}

function useSaveStep(step: number) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async (body: unknown) => {
    const updated = await api.put<CreatorSelf>(`/creators/me/onboarding/${step}`, body);
    qc.setQueryData(['creator', 'me'], updated);
    navigate(`/creator/onboarding/${step + 1}`);
  };
}

function StepActions({ step, submitting }: { step: number; submitting: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between gap-3 border-t border-line pt-5">
      {step > 1 ? <Link to={`/creator/onboarding/${step - 1}`} className="inline-flex min-h-11 items-center px-2 font-semibold text-primary">← {t('common.back')}</Link> : <span />}
      <Button type="submit" loading={submitting} size="lg">{t('common.saveContinue')}</Button>
    </div>
  );
}

function Step1({ p }: { p: CreatorSelf }) {
  const { t, i18n } = useTranslation();
  const fe = useFieldError();
  const save = useSaveStep(1);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, control, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<CreatorStep1>({
    resolver: zodResolver(creatorStep1Schema),
    defaultValues: {
      fullName: p.fullName ?? '', displayName: p.displayName ?? '', phone: p.phone ?? '', igHandle: p.igHandle ?? '', city: (p.city ?? undefined) as CreatorStep1['city'],
      languages: (p.languages.length ? p.languages : ['gu']) as CreatorStep1['languages'],
      gender: (p.gender ?? undefined) as CreatorStep1['gender'], ageGroup: (p.ageGroup ?? undefined) as CreatorStep1['ageGroup'], bio: p.bio ?? '',
    },
  });
  const onSubmit = async (v: CreatorStep1) => {
    setError(null);
    try {
      await save(v);
    } catch (e) {
      if (!applyServerErrors(e, setFieldError)) setError(errorText(t, e));
    }
  };
  const lang = i18n.language;
  return (
    <Card as="section">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <CardHeader icon={<UserRound />} title={t('onboarding.s1Title')} subtitle={t('onboarding.s1Text')} />
        <Field label={t('onboarding.fullName')} error={fe(errors.fullName?.message)} required>
          {(id, d) => <Input id={id} aria-describedby={d} autoComplete="name" invalid={!!errors.fullName} {...register('fullName')} />}
        </Field>
        <Field label={t('onboarding.displayName')} hint={t('onboarding.displayNameHint')} error={fe(errors.displayName?.message)} required>
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.displayName} {...register('displayName')} />}
        </Field>
        <Field label={t('onboarding.phone')} hint={t('onboarding.phoneHint')} error={fe(errors.phone?.message)} required>
          {(id, d) => <Input id={id} aria-describedby={d} type="tel" inputMode="tel" autoComplete="tel-national" maxLength={14} icon={<Phone />} placeholder="98XXXXXXXX" invalid={!!errors.phone} {...register('phone')} />}
        </Field>
        <Field label={t('onboarding.igHandle')} error={fe(errors.igHandle?.message)} required>
          {(id, d) => <Input id={id} aria-describedby={d} placeholder="@yourhandle" autoCapitalize="none" invalid={!!errors.igHandle} {...register('igHandle')} />}
        </Field>
        <Field label={t('onboarding.city')} error={fe(errors.city?.message)} required>
          {(id, d) => (
            <Select id={id} aria-describedby={d} invalid={!!errors.city} {...register('city', { setValueAs: optional })}>
              <option value="">{t('onboarding.selectCity')}</option>
              {CITIES.map((c) => <option key={c.key} value={c.key}>{cityLabel(c.key, lang)}</option>)}
            </Select>
          )}
        </Field>
        <div className="space-y-1.5">
          <p id="langs" className="text-sm font-medium">{t('onboarding.languages')} <span className="text-danger">*</span></p>
          <Controller control={control} name="languages" render={({ field }) => (
            <ChipSelect labelledBy="langs" value={field.value ?? []} onChange={field.onChange} max={3}
              options={LANGUAGES.map((l) => ({ value: l, label: t(`lang.${l}`) }))} />
          )} />
          {errors.languages && <p className="text-xs font-medium text-danger">{fe(errors.languages.message)}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t('onboarding.gender')} (${t('common.optional')})`}>
            {(id) => (
              <Select id={id} {...register('gender', { setValueAs: optional })}>
                <option value="">{t('onboarding.select')}</option>
                {GENDERS.map((g) => <option key={g} value={g}>{t(`gender.${g}`)}</option>)}
              </Select>
            )}
          </Field>
          <Field label={`${t('onboarding.ageGroup')} (${t('common.optional')})`}>
            {(id) => (
              <Select id={id} {...register('ageGroup', { setValueAs: optional })}>
                <option value="">{t('onboarding.select')}</option>
                {AGE_GROUPS.map((a) => <option key={a} value={a}>{t(`age.${a}`)}</option>)}
              </Select>
            )}
          </Field>
        </div>
        <Field label={`${t('onboarding.bio')} (${t('common.optional')})`} hint={t('onboarding.bioHint')} error={fe(errors.bio?.message)}>
          {(id, d) => <Textarea id={id} aria-describedby={d} maxLength={300} {...register('bio')} />}
        </Field>
        <fieldset className="space-y-3 rounded-ctl bg-primary-50 p-4 ring-1 ring-inset ring-primary-100">
          <Checkbox label={t('onboarding.consentCreator')} {...register('consents.creatorAgreement')} />
          {errors.consents && <p role="alert" className="text-xs font-medium text-danger">{t('errors.consentRequired')}</p>}
        </fieldset>
        {error && <Alert tone="red">{error}</Alert>}
        <StepActions step={1} submitting={isSubmitting} />
      </form>
    </Card>
  );
}

function Step2({ p }: { p: CreatorSelf }) {
  const { t, i18n } = useTranslation();
  const fe = useFieldError();
  const save = useSaveStep(2);
  const [error, setError] = useState<string | null>(null);
  const { handleSubmit, control, formState: { errors, isSubmitting } } = useForm<CreatorStep2>({
    resolver: zodResolver(creatorStep2Schema),
    defaultValues: { categories: p.categories as CreatorStep2['categories'] },
  });
  return (
    <Card as="section">
      <form onSubmit={handleSubmit(async (v) => { setError(null); try { await save(v); } catch (e) { setError(errorText(t, e)); } })} noValidate className="space-y-5">
        <div id="cats"><CardHeader icon={<LayoutGrid />} title={t('onboarding.s2Title')} subtitle={t('onboarding.s2Text')} /></div>
        <Controller control={control} name="categories" render={({ field }) => (
          <ChipSelect labelledBy="cats" value={field.value ?? []} onChange={field.onChange} max={3}
            options={CATEGORIES.map((c) => ({ value: c.key, label: categoryLabel(c.key, i18n.language), icon: <CategoryIcon k={c.key} className="h-3.5 w-3.5" /> }))} />
        )} />
        {errors.categories && <p role="alert" className="text-xs font-medium text-danger">{fe(errors.categories.message)}</p>}
        {error && <Alert tone="red">{error}</Alert>}
        <StepActions step={2} submitting={isSubmitting} />
      </form>
    </Card>
  );
}

function Step3({ p }: { p: CreatorSelf }) {
  const { t } = useTranslation();
  const fe = useFieldError();
  const save = useSaveStep(3);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<{ r1: string; r2: string; r3: string }>({
    defaultValues: { r1: p.reels[0] ?? '', r2: p.reels[1] ?? '', r3: p.reels[2] ?? '' },
  });
  const onSubmit = async (v: { r1: string; r2: string; r3: string }) => {
    setError(null);
    const reels = [v.r1, v.r2, v.r3].map((x) => x.trim()).filter(Boolean);
    const parsed = creatorStep3Schema.safeParse({ reels });
    if (!parsed.success) {
      setError(fe(parsed.error.issues[0]?.message) ?? t('errors.reelUrl'));
      return;
    }
    try {
      await save(parsed.data);
    } catch (e) {
      setError(errorText(t, e));
    }
  };
  return (
    <Card as="section">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <CardHeader icon={<Clapperboard />} title={t('onboarding.s3Title')} subtitle={t('onboarding.s3Text')} />
        {(['r1', 'r2', 'r3'] as const).map((k, i) => (
          <Field key={k} label={`${t('onboarding.reelN', { n: i + 1 })}${i === 2 ? ` (${t('common.optional')})` : ''}`} required={i < 2}>
            {(id) => <Input id={id} type="url" inputMode="url" placeholder="https://www.instagram.com/reel/..." autoCapitalize="none" {...register(k)} />}
          </Field>
        ))}
        {error && <Alert tone="red">{error}</Alert>}
        <StepActions step={3} submitting={isSubmitting} />
      </form>
    </Card>
  );
}

function Step4({ p }: { p: CreatorSelf }) {
  const { t } = useTranslation();
  const fe = useFieldError();
  const save = useSaveStep(4);
  const [error, setError] = useState<string | null>(null);
  const rupees = (k: string) => (p.rateCardPaise[k] !== undefined ? p.rateCardPaise[k] / 100 : undefined);
  const { register, handleSubmit, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<CreatorStep4>({
    resolver: zodResolver(creatorStep4Schema),
    defaultValues: {
      followers: p.stats.followers ?? undefined, avgViews: p.stats.avgViews ?? undefined, engagementRate: p.stats.engagementRate ?? undefined,
      rateCard: Object.fromEntries(DELIVERABLE_TYPES.map((d) => [d, rupees(d)])) as CreatorStep4['rateCard'],
      acceptsBarter: p.acceptsBarter,
    },
  });
  return (
    <Card as="section">
      <form onSubmit={handleSubmit(async (v) => { setError(null); try { await save(v); } catch (e) { if (!applyServerErrors(e, setFieldError)) setError(errorText(t, e)); } })} noValidate className="space-y-5">
        <CardHeader icon={<BarChart3 />} title={t('onboarding.s4Title')} subtitle={t('onboarding.s4Text')} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('onboarding.followers')} error={fe(errors.followers?.message)} required>
            {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" invalid={!!errors.followers} {...register('followers', { setValueAs: optionalNumber })} />}
          </Field>
          <Field label={t('onboarding.avgViews')} error={fe(errors.avgViews?.message)} required>
            {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" invalid={!!errors.avgViews} {...register('avgViews', { setValueAs: optionalNumber })} />}
          </Field>
          <Field label={t('onboarding.engagement')} hint={t('onboarding.engagementHint')} error={fe(errors.engagementRate?.message)} required>
            {(id, d) => <Input id={id} aria-describedby={d} inputMode="decimal" invalid={!!errors.engagementRate} {...register('engagementRate', { setValueAs: optionalNumber })} />}
          </Field>
        </div>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">{t('onboarding.rateCard')}</legend>
          <p className="text-xs text-ink-muted">{t('onboarding.rateHint')}</p>
          {errors.rateCard?.message && <p role="alert" className="text-xs font-medium text-danger">{fe(errors.rateCard.message)}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {DELIVERABLE_TYPES.map((d) => (
              <Field key={d} label={t(`deliverable.${d}`)} error={fe(errors.rateCard?.[d]?.message)}>
                {(id, desc) => <Input id={id} aria-describedby={desc} inputMode="numeric" placeholder="₹" {...register(`rateCard.${d}`, { setValueAs: optionalNumber })} />}
              </Field>
            ))}
          </div>
        </fieldset>
        <Checkbox label={t('onboarding.barter')} {...register('acceptsBarter')} />
        {error && <Alert tone="red">{error}</Alert>}
        <StepActions step={4} submitting={isSubmitting} />
      </form>
    </Card>
  );
}

function Step5({ p }: { p: CreatorSelf }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { reloadMe } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/creators/me/submit');
      await qc.invalidateQueries({ queryKey: ['creator'] });
      await reloadMe();
      navigate('/creator/status', { replace: true });
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };
  const row = (label: string, value: string, step: number) => (
    <div className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-0">
      <div><p className="text-xs text-ink-muted">{label}</p><p className="font-medium">{value || '—'}</p></div>
      <Link to={`/creator/onboarding/${step}`} className="text-sm font-semibold text-primary">{t('common.edit')}</Link>
    </div>
  );
  return (
    <Card as="section">
      <CardHeader icon={<ClipboardCheck />} title={t('onboarding.s5Title')} subtitle={t('onboarding.s5Text')} />
      {row(t('onboarding.fullName'), `${p.fullName ?? ''} · ${p.displayName ?? ''}`, 1)}
      {row(t('onboarding.phone'), p.phone ?? '', 1)}
      {row(t('onboarding.igHandle'), p.igHandle ? `@${p.igHandle}` : '', 1)}
      {row(t('onboarding.city'), p.city ? cityLabel(p.city, lang) : '', 1)}
      {row(t('onboarding.s2Title'), p.categories.map((c) => categoryLabel(c, lang)).join(', '), 2)}
      {row(t('onboarding.s3Title'), p.reels.join('\n'), 3)}
      {row(t('onboarding.s4Title'), [
        p.stats.followers != null ? `${p.stats.followers.toLocaleString('en-IN')} ${t('onboarding.followers')}` : '',
        p.stats.engagementRate != null ? `${p.stats.engagementRate}%` : '',
        ...Object.entries(p.rateCardPaise).map(([k, v]) => `${t(`deliverable.${k}`)} ${formatINR(v)}`),
      ].filter(Boolean).join(' · '), 4)}
      {error && <div className="mt-4"><Alert tone="red">{error}</Alert></div>}
      <div className="mt-5 flex justify-between">
        <Link to="/creator/onboarding/4" className="inline-flex min-h-11 items-center px-2 font-semibold text-primary">← {t('common.back')}</Link>
        <Button size="lg" variant="accent" loading={busy} onClick={submit}>{t('onboarding.submit')}</Button>
      </div>
    </Card>
  );
}
