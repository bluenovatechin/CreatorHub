import { useState, type ReactNode } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import type { ZodTypeAny } from 'zod';
import {
  AGE_GROUPS, CAMPAIGN_GOALS, CATEGORIES, CITIES, COLLAB_TYPES, DELIVERABLE_TYPES, FOLLOWER_BANDS, GENDERS, LANGUAGES,
  CAMPAIGN_STEP_SCHEMAS, todayIST,
} from '../../lib/zod';
import { Alert, Button, Card, CardHeader, Checkbox, ChipSelect, Field, Input, PageHeader, Select, Stepper, Textarea } from '@bluenova/ui';
import { CalendarDays, ClipboardCheck, Clapperboard, FileText, IndianRupee, Plus, Trash2, Users } from 'lucide-react';
import { CategoryIcon } from '../../components/icons';
import { ApiError, api, errorText } from '../../lib/api';
import { categoryLabel, cityLabel, formatDate, formatINR, lines, words } from '../../lib/format';
import type { CampaignView } from '../../lib/types';
import { QueryState, useFieldError } from '../../components/common';

type Errors = Record<string, string>;

/** Validates with the shared schema (same rules as the server) and returns field → message. */
function check(schema: ZodTypeAny, payload: unknown): { ok: true; data: unknown } | { ok: false; errors: Errors } {
  const r = schema.safeParse(payload);
  if (r.success) return { ok: true, data: r.data };
  const errors: Errors = {};
  for (const i of r.error.issues) {
    const k = String(i.path[0] ?? '_');
    if (!errors[k]) errors[k] = i.message;
  }
  return { ok: false, errors };
}

function useSave(id: string | undefined, step: number) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async (payload: unknown) => {
    setFormError(null);
    const v = check(CAMPAIGN_STEP_SCHEMAS[step as 1 | 2 | 3 | 4 | 5], payload);
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const saved = id
        ? await api.put<CampaignView>(`/campaigns/${id}/wizard/${step}`, v.data)
        : await api.post<CampaignView>('/campaigns', v.data);
      qc.setQueryData(['campaigns', saved.id], saved);
      void qc.invalidateQueries({ queryKey: ['campaigns'], exact: true });
      navigate(`/brand/campaigns/${saved.id}/edit/${step + 1}`);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) setErrors(e.fields);
      else setFormError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };
  return { save, errors, formError, busy };
}

const STEP_ICONS = [<FileText key="1" />, <Users key="2" />, <Clapperboard key="3" />, <CalendarDays key="4" />, <IndianRupee key="5" />, <ClipboardCheck key="6" />];

function Shell({ step, id, title, children, onSubmit, busy, formError }: {
  step: number; id?: string; title: string; children: ReactNode; onSubmit: () => void; busy: boolean; formError: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('wizard.title')} />
      <Stepper steps={t('wizard.steps', { returnObjects: true }) as string[]} current={step} />
      <Card as="section">
        <form noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-6">
          <CardHeader icon={STEP_ICONS[step - 1]} title={title} />
          {children}
          {formError && <Alert tone="red">{formError}</Alert>}
          <div className="flex justify-between gap-3 border-t border-line pt-5">
            {step > 1 && id ? <Link to={`/brand/campaigns/${id}/edit/${step - 1}`} className="inline-flex min-h-11 items-center px-2 font-semibold text-primary">← {t('common.back')}</Link> : <span />}
            <Button type="submit" size="lg" loading={busy}>{t('common.saveContinue')}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function CampaignWizard() {
  const { id, step: stepParam } = useParams();
  const step = id ? Math.min(6, Math.max(1, Number(stepParam) || 1)) : 1;
  const q = useQuery({ queryKey: ['campaigns', id], queryFn: () => api.get<CampaignView>(`/campaigns/${id}`), enabled: !!id });
  if (id && (q.isLoading || q.error)) return <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />;
  const c = q.data;
  if (c && c.status !== 'DRAFT') return <Navigate to={`/brand/campaigns/${c.id}`} replace />;
  if (c && step > c.wizardStep) return <Navigate to={`/brand/campaigns/${c.id}/edit/${c.wizardStep}`} replace />;
  const key = `${id ?? 'new'}-${step}`;
  switch (step) {
    case 1: return <Step1 key={key} c={c} />;
    case 2: return <Step2 key={key} c={c!} />;
    case 3: return <Step3 key={key} c={c!} />;
    case 4: return <Step4 key={key} c={c!} />;
    case 5: return <Step5 key={key} c={c!} />;
    default: return <Review key={key} c={c!} />;
  }
}

function Step1({ c }: { c?: CampaignView }) {
  const { t } = useTranslation();
  const fe = useFieldError();
  const { save, errors, formError, busy } = useSave(c?.id, 1);
  const { register, getValues } = useForm({ defaultValues: { title: c?.title ?? '', goal: c?.goal ?? '', description: c?.description ?? '' } });
  return (
    <Shell step={1} id={c?.id} title={t('wizard.steps.0')} onSubmit={() => save(getValues())} busy={busy} formError={formError}>
      <Field label={t('wizard.campTitle')} error={fe(errors.title)} required>
        {(id, d) => <Input id={id} aria-describedby={d} maxLength={100} invalid={!!errors.title} {...register('title')} />}
      </Field>
      <Field label={t('wizard.goal')} error={fe(errors.goal)} required>
        {(id, d) => (
          <Select id={id} aria-describedby={d} invalid={!!errors.goal} {...register('goal')}>
            <option value="">{t('onboarding.select')}</option>
            {CAMPAIGN_GOALS.map((g) => <option key={g} value={g}>{t(`goal.${g}`)}</option>)}
          </Select>
        )}
      </Field>
      <Field label={t('wizard.description')} error={fe(errors.description)} required>
        {(id, d) => <Textarea id={id} aria-describedby={d} rows={5} maxLength={2000} invalid={!!errors.description} {...register('description')} />}
      </Field>
    </Shell>
  );
}

function Step2({ c }: { c: CampaignView }) {
  const { t, i18n } = useTranslation();
  const fe = useFieldError();
  const lang = i18n.language;
  const { save, errors, formError, busy } = useSave(c.id, 2);
  const { control, register, getValues } = useForm({
    defaultValues: {
      categories: c.filters.categories, cities: c.filters.cities, languages: c.filters.languages, followerBands: c.filters.followerBands,
      genders: c.filters.genders, ageGroups: c.filters.ageGroups, minEngagementRate: c.filters.minEngagementRate?.toString() ?? '',
    },
  });
  const chips = (name: 'categories' | 'cities' | 'languages' | 'followerBands' | 'genders' | 'ageGroups', label: string, options: { value: string; label: string }[], required = false, hint?: string) => (
    <div className="space-y-1.5">
      <p id={`l-${name}`} className="text-sm font-medium">{label} {required && <span className="text-danger">*</span>}</p>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
      <Controller control={control} name={name} render={({ field }) => <ChipSelect labelledBy={`l-${name}`} value={field.value} onChange={field.onChange} options={options} />} />
      {errors[name] && <p role="alert" className="text-xs font-medium text-danger">{fe(errors[name])}</p>}
    </div>
  );
  return (
    <Shell step={2} id={c.id} title={t('wizard.steps.1')} busy={busy} formError={formError}
      onSubmit={() => { const v = getValues(); save({ ...v, minEngagementRate: v.minEngagementRate === '' ? undefined : Number(v.minEngagementRate) }); }}>
      {chips('categories', t('wizard.categories'), CATEGORIES.map((x) => ({ value: x.key, label: categoryLabel(x.key, lang), icon: <CategoryIcon k={x.key} className="h-3.5 w-3.5" /> })), true)}
      {chips('cities', t('wizard.cities'), CITIES.map((x) => ({ value: x.key, label: cityLabel(x.key, lang) })), false, t('wizard.citiesHint'))}
      {chips('languages', t('wizard.languages'), LANGUAGES.map((x) => ({ value: x, label: t(`lang.${x}`) })))}
      {chips('followerBands', t('wizard.bands'), FOLLOWER_BANDS.map((x) => ({ value: x, label: t(`band.${x}`) })))}
      {chips('genders', t('wizard.genders'), GENDERS.filter((g) => g !== 'prefer_not_say').map((x) => ({ value: x, label: t(`gender.${x}`) })))}
      {chips('ageGroups', t('wizard.ageGroups'), AGE_GROUPS.map((x) => ({ value: x, label: t(`age.${x}`) })))}
      <Field label={`${t('wizard.minEng')} (${t('common.optional')})`} error={fe(errors.minEngagementRate)}>
        {(id) => <Input id={id} inputMode="decimal" className="max-w-32" {...register('minEngagementRate')} />}
      </Field>
    </Shell>
  );
}

function Step3({ c }: { c: CampaignView }) {
  const { t } = useTranslation();
  const fe = useFieldError();
  const { save, errors, formError, busy } = useSave(c.id, 3);
  const { control, register, getValues, watch } = useForm({
    defaultValues: {
      deliverables: c.deliverables.length ? c.deliverables.map((d) => ({ type: d.type, quantity: String(d.quantity) })) : [{ type: 'REEL', quantity: '1' }],
      creatorsNeeded: c.creatorsNeeded?.toString() ?? '1', collabType: c.collabType ?? 'PAID',
      productName: c.product?.name ?? '', productValue: c.product ? String(c.product.valuePaise / 100) : '', shipping: c.product?.shippingRequired ?? true,
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'deliverables' });
  const collab = watch('collabType');
  const submit = () => {
    const v = getValues();
    save({
      deliverables: v.deliverables.map((d) => ({ type: d.type, quantity: Number(d.quantity) })),
      creatorsNeeded: Number(v.creatorsNeeded), collabType: v.collabType,
      product: v.collabType === 'PAID' ? undefined : { name: v.productName, value: Number(v.productValue || 0), shippingRequired: v.shipping },
    });
  };
  return (
    <Shell step={3} id={c.id} title={t('wizard.steps.2')} onSubmit={submit} busy={busy} formError={formError}>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">{t('wizard.deliverables')} <span className="text-danger">*</span></legend>
        {fields.map((f, i) => (
          <div key={f.id} className="flex gap-2">
            <Select aria-label={t('wizard.deliverables')} {...register(`deliverables.${i}.type`)}>
              {DELIVERABLE_TYPES.map((d) => <option key={d} value={d}>{t(`deliverable.${d}`)}</option>)}
            </Select>
            <Input aria-label={t('wizard.qty')} inputMode="numeric" className="w-20" {...register(`deliverables.${i}.quantity`)} />
            {fields.length > 1 && <Button variant="ghost" aria-label={t('common.remove')} onClick={() => remove(i)} icon={<Trash2 className="h-4 w-4" />} />}
          </div>
        ))}
        {fields.length < 5 && <Button variant="ghost" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => append({ type: 'POST', quantity: '1' })}>{t('wizard.addDeliverable')}</Button>}
        {errors.deliverables && <p role="alert" className="text-xs font-medium text-danger">{fe(errors.deliverables)}</p>}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('wizard.creatorsNeeded')} error={fe(errors.creatorsNeeded)} required>
          {(id) => <Input id={id} inputMode="numeric" {...register('creatorsNeeded')} />}
        </Field>
        <Field label={t('wizard.collabType')} required>
          {(id) => <Select id={id} {...register('collabType')}>{COLLAB_TYPES.map((x) => <option key={x} value={x}>{t(`collab.${x}`)}</option>)}</Select>}
        </Field>
      </div>
      {collab !== 'PAID' && (
        <fieldset className="space-y-4 rounded-ctl bg-bg p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('wizard.productName')} error={fe(errors.product)} required>{(id) => <Input id={id} {...register('productName')} />}</Field>
            <Field label={t('wizard.productValue')} required>{(id) => <Input id={id} inputMode="numeric" {...register('productValue')} />}</Field>
          </div>
          <Checkbox label={t('wizard.shipping')} {...register('shipping')} />
        </fieldset>
      )}
    </Shell>
  );
}

function Step4({ c }: { c: CampaignView }) {
  const { t } = useTranslation();
  const fe = useFieldError();
  const { save, errors, formError, busy } = useSave(c.id, 4);
  const iso = (d: string | null) => (d ? todayIST(new Date(d)) : '');
  const { register, getValues } = useForm({
    defaultValues: {
      startDate: iso(c.startDate), endDate: iso(c.endDate), dos: c.guidelines.dos.join('\n'), donts: c.guidelines.donts.join('\n'),
      refs: c.guidelines.referenceUrls.join('\n'), hashtags: c.guidelines.hashtags.join(' '), mentions: c.guidelines.mentions.join(' '),
      maxRevisions: String(c.maxRevisions ?? 2),
    },
  });
  const submit = () => {
    const v = getValues();
    save({
      startDate: v.startDate, endDate: v.endDate, dos: lines(v.dos), donts: lines(v.donts), referenceUrls: lines(v.refs),
      hashtags: words(v.hashtags), mentions: words(v.mentions), maxRevisions: Number(v.maxRevisions),
    });
  };
  return (
    <Shell step={4} id={c.id} title={t('wizard.steps.3')} onSubmit={submit} busy={busy} formError={formError}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('wizard.startDate')} error={fe(errors.startDate)} required>
          {(id, d) => <Input id={id} aria-describedby={d} type="date" min={todayIST()} invalid={!!errors.startDate} {...register('startDate')} />}
        </Field>
        <Field label={t('wizard.endDate')} error={fe(errors.endDate)} required>
          {(id, d) => <Input id={id} aria-describedby={d} type="date" min={todayIST()} invalid={!!errors.endDate} {...register('endDate')} />}
        </Field>
      </div>
      <Field label={t('wizard.dos')} error={fe(errors.dos)}>{(id) => <Textarea id={id} rows={3} {...register('dos')} />}</Field>
      <Field label={t('wizard.donts')} error={fe(errors.donts)}>{(id) => <Textarea id={id} rows={3} {...register('donts')} />}</Field>
      <Field label={t('wizard.refs')} error={fe(errors.referenceUrls)}>{(id) => <Textarea id={id} rows={2} placeholder="https://" {...register('refs')} />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('wizard.hashtags')} error={fe(errors.hashtags)}>{(id) => <Input id={id} placeholder="#diwali #surat" {...register('hashtags')} />}</Field>
        <Field label={t('wizard.mentions')} error={fe(errors.mentions)}>{(id) => <Input id={id} placeholder="@yourbrand" {...register('mentions')} />}</Field>
      </div>
      <Field label={t('wizard.maxRevisions')}>
        {(id) => <Select id={id} className="max-w-32" {...register('maxRevisions')}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</Select>}
      </Field>
      <Alert tone="amber">⚠️ {t('wizard.disclosureNote')}</Alert>
    </Shell>
  );
}

function Step5({ c }: { c: CampaignView }) {
  const { t } = useTranslation();
  const fe = useFieldError();
  const { save, errors, formError, busy } = useSave(c.id, 5);
  const { register, getValues, watch } = useForm({
    defaultValues: {
      budgetSuggest: c.budget?.suggest ?? false,
      budgetMin: c.budget?.minPaise != null ? String(c.budget.minPaise / 100) : '', budgetMax: c.budget?.maxPaise != null ? String(c.budget.maxPaise / 100) : '',
      usageRightsRequired: c.usageRights?.isRequired ?? false, usageRightsDays: c.usageRights?.durationDays?.toString() ?? '',
    },
  });
  const suggest = watch('budgetSuggest');
  const usage = watch('usageRightsRequired');
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
  const submit = () => {
    const v = getValues();
    save({
      budgetSuggest: v.budgetSuggest, budgetMin: v.budgetSuggest ? undefined : num(v.budgetMin), budgetMax: v.budgetSuggest ? undefined : num(v.budgetMax),
      usageRightsRequired: v.usageRightsRequired, usageRightsDays: v.usageRightsRequired ? num(v.usageRightsDays) : undefined,
    });
  };
  return (
    <Shell step={5} id={c.id} title={t('wizard.steps.4')} onSubmit={submit} busy={busy} formError={formError}>
      <Checkbox label={t('wizard.budgetSuggest')} {...register('budgetSuggest')} />
      {!suggest && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('wizard.budgetMin')} error={fe(errors.budgetMin)} required>{(id) => <Input id={id} inputMode="numeric" {...register('budgetMin')} />}</Field>
          <Field label={t('wizard.budgetMax')} error={fe(errors.budgetMax)} required>{(id) => <Input id={id} inputMode="numeric" {...register('budgetMax')} />}</Field>
        </div>
      )}
      <Checkbox label={t('wizard.usage')} {...register('usageRightsRequired')} />
      {usage && <Field label={t('wizard.usageDays')} error={fe(errors.usageRightsDays)}>{(id) => <Input id={id} inputMode="numeric" className="max-w-32" {...register('usageRightsDays')} />}</Field>}
    </Shell>
  );
}

function Review({ c }: { c: CampaignView }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/campaigns/${c.id}/submit`);
      await qc.invalidateQueries({ queryKey: ['campaigns'] });
      navigate(`/brand/campaigns/${c.id}`, { replace: true });
    } catch (e) {
      setError(errorText(t, e));
    } finally {
      setBusy(false);
    }
  };
  const row = (label: string, value: string, step: number) => (
    <div className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-0">
      <div><p className="text-xs text-ink-muted">{label}</p><p className="whitespace-pre-line font-medium">{value || '—'}</p></div>
      <Link to={`/brand/campaigns/${c.id}/edit/${step}`} className="text-sm font-semibold text-primary">{t('common.edit')}</Link>
    </div>
  );
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('wizard.title')} />
      <Stepper steps={t('wizard.steps', { returnObjects: true }) as string[]} current={6} />
      <Card>
        <CardHeader icon={<ClipboardCheck />} title={t('wizard.reviewTitle')} />
        {row(t('wizard.campTitle'), `${c.title}\n${c.goal ? t(`goal.${c.goal}`) : ''}`, 1)}
        {row(t('wizard.categories'), [c.filters.categories.map((k) => categoryLabel(k, lang)).join(', '), c.filters.cities.map((k) => cityLabel(k, lang)).join(', ')].filter(Boolean).join('\n'), 2)}
        {row(t('wizard.deliverables'), `${c.deliverables.map((d) => `${d.quantity}× ${t(`deliverable.${d.type}`)}`).join(', ')} · ${c.creatorsNeeded} creators · ${c.collabType ? t(`collab.${c.collabType}`) : ''}`, 3)}
        {row(t('wizard.startDate'), `${formatDate(c.startDate, lang)} – ${formatDate(c.endDate, lang)}`, 4)}
        {row(t('wizard.steps.4'), c.budget?.suggest ? t('wizard.budgetSuggest') : c.budget?.minPaise != null ? `${formatINR(c.budget.minPaise)} – ${formatINR(c.budget.maxPaise ?? 0)}` : '', 5)}
        {error && <div className="mt-4"><Alert tone="red">{error}</Alert></div>}
        <div className="mt-5 flex justify-between">
          <Link to={`/brand/campaigns/${c.id}/edit/5`} className="inline-flex min-h-11 items-center px-2 font-semibold text-primary">← {t('common.back')}</Link>
          <Button size="lg" variant="accent" loading={busy} onClick={submit}>{t('wizard.submit')}</Button>
        </div>
      </Card>
    </div>
  );
}
