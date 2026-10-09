/**
 * BRAND AREA: company profile form (first visit), dashboard, campaigns list and detail
 * (see shortlist, select creators, cancel), deals.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Building2, Calendar, CheckCircle2, Clapperboard, Clock, Handshake, Instagram, MapPin,
  Megaphone, Phone, Plus, Receipt, Star, Users, Wallet,
} from 'lucide-react';
import { CATEGORIES, CITIES, INDIAN_STATES, brandOnboardingSchema, type BrandOnboarding } from '../../lib/zod';
import {
  Alert, Avatar, Badge, Button, Card, CardHeader, Checkbox, Dialog, EmptyState, ExternalLink, Field, Input, PageHeader,
  Select, StatCard, Tag, Textarea, Timeline, cx,
} from '@bluenova/ui';
import { api, applyServerErrors, errorText } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { categoryLabel, cityLabel, formatDate, formatINR } from '../../lib/format';
import type { BrandSelf, CampaignView, CheckoutView, DealView, ShortlistItemView } from '../../lib/types';
import { CategoryIcon } from '../../components/icons';
import { useAppConfig } from '../../lib/config';
import { QueryState, SafetyTip, StatusBadge, useFieldError } from '../../components/common';

const optional = (v: unknown) => (v === '' || v === null ? undefined : v);
const primaryLink = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-ctl bg-primary px-4 text-sm font-semibold text-white shadow-btn transition hover:bg-primary-hover';

/* ---------- onboarding / company details ---------- */

export function BrandOnboardingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const fe = useFieldError();
  const { reloadMe, me } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['brand', 'me'], queryFn: () => api.get<BrandSelf>('/brands/me') });
  const b = q.data;
  const firstTime = b?.status === 'INCOMPLETE';
  const { register, handleSubmit, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<BrandOnboarding>({
    resolver: zodResolver(brandOnboardingSchema),
    values: b ? {
      companyName: b.companyName ?? '', contactName: b.contactName ?? me?.name ?? '', designation: b.designation ?? '', phone: b.phone ?? '',
      gstin: b.gstin ?? '', industry: (b.industry ?? undefined) as BrandOnboarding['industry'], city: (b.city ?? undefined) as BrandOnboarding['city'],
      website: b.website ?? '',
      billingAddress: {
        line1: b.billingAddress?.line1 ?? '', line2: b.billingAddress?.line2 ?? '', city: b.billingAddress?.city ?? '',
        stateCode: b.billingAddress?.stateCode ?? '24', pincode: b.billingAddress?.pincode ?? '',
      },
      consents: { brandAgreement: !firstTime },
    } as BrandOnboarding : undefined,
  });
  if (q.isLoading || q.error) return <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />;

  const onSubmit = async (v: BrandOnboarding) => {
    setError(null);
    try {
      await api.put('/brands/me', v);
      await qc.invalidateQueries({ queryKey: ['brand'] });
      await reloadMe();
      navigate('/brand', { replace: true });
    } catch (e) {
      if (!applyServerErrors(e, setFieldError)) setError(errorText(t, e));
    }
  };
  const lang = i18n.language;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('brandOnboarding.title')} subtitle={t('brandOnboarding.subtitle')} />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Card>
          <CardHeader icon={<Building2 />} title={t('brandOnboarding.secCompany')} />
          <div className="space-y-5">
            <Field label={t('brandOnboarding.companyName')} error={fe(errors.companyName?.message)} required>
              {(id, d) => <Input id={id} aria-describedby={d} autoComplete="organization" invalid={!!errors.companyName} {...register('companyName')} />}
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('brandOnboarding.industry')} error={fe(errors.industry?.message)} required>
                {(id, d) => (
                  <Select id={id} aria-describedby={d} invalid={!!errors.industry} {...register('industry', { setValueAs: optional })}>
                    <option value="">{t('onboarding.select')}</option>
                    {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{categoryLabel(c.key, lang)}</option>)}
                  </Select>
                )}
              </Field>
              <Field label={t('brandOnboarding.city')} error={fe(errors.city?.message)} required>
                {(id, d) => (
                  <Select id={id} aria-describedby={d} invalid={!!errors.city} {...register('city', { setValueAs: optional })}>
                    <option value="">{t('onboarding.select')}</option>
                    {CITIES.map((c) => <option key={c.key} value={c.key}>{cityLabel(c.key, lang)}</option>)}
                  </Select>
                )}
              </Field>
              <Field label={`${t('brandOnboarding.gstin')} (${t('common.optional')})`} hint={t('brandOnboarding.gstinHint')} error={fe(errors.gstin?.message)}>
                {(id, d) => <Input id={id} aria-describedby={d} autoCapitalize="characters" maxLength={15} placeholder="24ABCDE1234F1Z5" className="uppercase" invalid={!!errors.gstin} {...register('gstin')} />}
              </Field>
              <Field label={`${t('brandOnboarding.website')} (${t('common.optional')})`} error={fe(errors.website?.message)}>
                {(id, d) => <Input id={id} aria-describedby={d} type="url" placeholder="https://" invalid={!!errors.website} {...register('website')} />}
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Users />} title={t('brandOnboarding.secContact')} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('brandOnboarding.contactName')} error={fe(errors.contactName?.message)} required>
              {(id, d) => <Input id={id} aria-describedby={d} autoComplete="name" invalid={!!errors.contactName} {...register('contactName')} />}
            </Field>
            <Field label={`${t('brandOnboarding.designation')} (${t('common.optional')})`} error={fe(errors.designation?.message)}>
              {(id) => <Input id={id} {...register('designation')} />}
            </Field>
            <Field label={t('brandOnboarding.phone')} hint={t('brandOnboarding.phoneHint')} error={fe(errors.phone?.message)} required>
              {(id, d) => <Input id={id} aria-describedby={d} type="tel" inputMode="tel" autoComplete="tel-national" maxLength={14} icon={<Phone />} invalid={!!errors.phone} {...register('phone')} />}
            </Field>
            <Field label={t('brandOnboarding.accountEmail')}>
              {(id) => <Input id={id} value={me?.email ?? ''} disabled readOnly />}
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Receipt />} title={t('brandOnboarding.secBilling')} />
          <div className="space-y-5">
            <Field label={t('brandOnboarding.line1')} error={fe(errors.billingAddress?.line1?.message)} required>
              {(id) => <Input id={id} autoComplete="address-line1" invalid={!!errors.billingAddress?.line1} {...register('billingAddress.line1')} />}
            </Field>
            <Field label={`${t('brandOnboarding.line2')} (${t('common.optional')})`}>
              {(id) => <Input id={id} autoComplete="address-line2" {...register('billingAddress.line2')} />}
            </Field>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label={t('brandOnboarding.addrCity')} error={fe(errors.billingAddress?.city?.message)} required>
                {(id) => <Input id={id} autoComplete="address-level2" invalid={!!errors.billingAddress?.city} {...register('billingAddress.city')} />}
              </Field>
              <Field label={t('brandOnboarding.state')} required>
                {(id) => <Select id={id} autoComplete="address-level1" {...register('billingAddress.stateCode')}>{INDIAN_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</Select>}
              </Field>
              <Field label={t('brandOnboarding.pincode')} hint={t('brandOnboarding.pincodeHint')} error={fe(errors.billingAddress?.pincode?.message)} required>
                {(id, d) => <Input id={id} aria-describedby={d} inputMode="numeric" maxLength={6} autoComplete="postal-code" invalid={!!errors.billingAddress?.pincode} {...register('billingAddress.pincode')} />}
              </Field>
            </div>
          </div>
        </Card>

        {firstTime && (
          <div className="rounded-card bg-primary-50 p-4 ring-1 ring-inset ring-primary-100">
            <Checkbox label={t('brandOnboarding.consentBrand')} {...register('consents.brandAgreement')} />
            {(errors as { consents?: unknown }).consents ? <p role="alert" className="mt-1 text-xs font-medium text-danger">{t('errors.consentRequired')}</p> : null}
          </div>
        )}
        {error && <Alert tone="red">{error}</Alert>}
        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={isSubmitting}>{t('brandOnboarding.save')}</Button>
        </div>
      </form>
    </div>
  );
}

/* ---------- dashboard & campaign list ---------- */

const useCampaigns = () => useQuery({ queryKey: ['campaigns'], queryFn: () => api.get<CampaignView[]>('/campaigns') });

function CampaignRow({ c }: { c: CampaignView }) {
  const { t, i18n } = useTranslation();
  const href = c.status === 'DRAFT' ? `/brand/campaigns/${c.id}/edit/${Math.min(6, c.wizardStep)}` : `/brand/campaigns/${c.id}`;
  return (
    <li>
      <Link to={href} className="group flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-primary-50/50">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><Megaphone className="h-5 w-5" aria-hidden="true" /></span>
          <div>
            <p className="font-semibold text-navy">{c.title}</p>
            <p className="flex items-center gap-1.5 text-xs text-ink-muted"><Calendar className="h-3.5 w-3.5" />
              {c.startDate ? `${formatDate(c.startDate, i18n.language)} – ${formatDate(c.endDate, i18n.language)}` : formatDate(c.createdAt, i18n.language)}
              {c.goal ? ` · ${t(`goal.${c.goal}`)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3"><StatusBadge kind="campaign" status={c.status} /><ArrowRight className="h-4 w-4 text-ink-faint group-hover:text-primary" aria-hidden="true" /></div>
      </Link>
    </li>
  );
}

export function BrandDashboard() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const { paymentsEnabled } = useAppConfig();
  const q = useCampaigns();
  const deals = useQuery({ queryKey: ['deals'], queryFn: () => api.get<DealView[]>('/deals') });
  const list = q.data ?? [];
  const shortlistReady = list.filter((c) => c.status === 'SHORTLIST_SENT');
  const payDue = list.filter((c) => c.status === 'PAYMENT_PENDING');
  const working = (deals.data ?? []).filter((d) => ['IN_PRODUCTION', 'DRAFT_SUBMITTED', 'BRAND_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'LIVE_SUBMITTED'].includes(d.status)).length;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[24px] bg-brand-gradient p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold">{t('brandHome.hello', { name: me?.brand?.companyName ?? '' })}</h1>
            <p className="mt-1 text-primary-100">{t('brandHome.subtitle')}</p>
          </div>
          <Link to="/brand/campaigns/new" className="inline-flex min-h-11 items-center gap-2 rounded-ctl bg-white px-4 text-sm font-semibold text-navy shadow-sm hover:bg-primary-50"><Plus className="h-4 w-4" />{t('brandHome.newCampaign')}</Link>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Megaphone />} label={t('brandHome.statActive')} value={list.filter((c) => c.status === 'ACTIVE').length} tone="teal" />
        <StatCard icon={<Clock />} label={t('brandHome.statWaiting')} value={list.filter((c) => ['SUBMITTED', 'IN_REVIEW'].includes(c.status)).length} />
        <StatCard icon={<Wallet />} label={paymentsEnabled ? t('brandHome.statPay') : t('brandHome.statStarting')} value={payDue.length} tone="amber" />
        <StatCard icon={<Users />} label={t('brandHome.statCreators')} value={working} tone="green" />
      </div>

      <section>
        <h2 className="mb-4 font-display text-xl font-bold text-navy">{t('brandHome.actionTitle')}</h2>
        {shortlistReady.length + payDue.length === 0 ? (
          <p className="flex items-center gap-2 rounded-card border border-line bg-white px-5 py-4 text-ink-muted"><CheckCircle2 className="h-5 w-5 text-success" />{t('brandHome.nothing')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {shortlistReady.map((c) => (
              <Link key={c.id} to={`/brand/campaigns/${c.id}`} className="flex items-center justify-between gap-3 rounded-card border border-primary-200 bg-primary-50 p-4 font-semibold text-navy hover:shadow-card">
                <span className="flex items-center gap-3"><Star className="h-5 w-5 text-primary" />{t('brandHome.shortlistReady', { title: c.title })}</span><ArrowRight className="h-4 w-4" />
              </Link>
            ))}
            {payDue.map((c) => (
              <Link key={c.id} to={paymentsEnabled ? `/brand/campaigns/${c.id}/payment` : `/brand/campaigns/${c.id}`} className="flex items-center justify-between gap-3 rounded-card border border-warning/30 bg-warning-soft p-4 font-semibold text-warning hover:shadow-card">
                <span className="flex items-center gap-3"><Clock className="h-5 w-5" />{paymentsEnabled ? t('brandHome.paymentDue', { title: c.title }) : t('brandHome.awaitingStart', { title: c.title })}</span><ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-navy">{t('brandHome.campaignsTitle')}</h2>
          <Link to="/brand/campaigns" className="text-sm font-semibold text-primary hover:underline">{t('common.seeAll')}</Link>
        </div>
        {q.isLoading || q.error ? <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} /> : list.length === 0 ? (
          <EmptyState icon={<Megaphone />} title={t('brandHome.noCampaigns')} text={t('brandHome.noCampaignsText')}
            action={<Link to="/brand/campaigns/new" className={primaryLink}><Plus className="h-4 w-4" />{t('brandHome.newCampaign')}</Link>} />
        ) : <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">{list.slice(0, 5).map((c) => <CampaignRow key={c.id} c={c} />)}</ul>}
      </section>
      <SafetyTip />
    </div>
  );
}

export function CampaignsPage() {
  const { t } = useTranslation();
  const q = useCampaigns();
  return (
    <div>
      <PageHeader title={t('nav.campaigns')} action={<Link to="/brand/campaigns/new" className={primaryLink}><Plus className="h-4 w-4" />{t('brandHome.newCampaign')}</Link>} />
      {q.isLoading || q.error ? <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} /> : q.data!.length === 0
        ? <EmptyState icon={<Megaphone />} title={t('brandHome.noCampaigns')} text={t('brandHome.noCampaignsText')} />
        : <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">{q.data!.map((c) => <CampaignRow key={c.id} c={c} />)}</ul>}
    </div>
  );
}

/* ---------- campaign detail + shortlist ---------- */

function CreatorCardView({ i, selectable, picked, onToggle }: { i: ShortlistItemView; selectable: boolean; picked: boolean; onToggle: () => void }) {
  const { t, i18n } = useTranslation();
  const cr = i.creator;
  const lang = i18n.language;
  return (
    <div className={cx('flex flex-col rounded-card border bg-white p-5 shadow-card transition', picked ? 'border-primary ring-4 ring-primary/10' : 'border-line')}>
      <div className="flex items-start gap-3">
        <Avatar name={cr?.displayName} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-display text-lg font-bold text-navy">{cr?.displayName}</p>
            {cr?.isPartner && <BadgeCheck className="h-5 w-5 shrink-0 text-primary" aria-label={t('status.creator.APPROVED')} />}
          </div>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
            {cr?.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{cityLabel(cr.city, lang)}</span>}
            {cr?.igHandle && <span className="flex items-center gap-1"><Instagram className="h-3.5 w-3.5" />@{cr.igHandle}</span>}
          </p>
        </div>
        {i.status === 'SELECTED' && <Badge tone="green">{t('campaign.selected')}</Badge>}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {cr?.categories.map((k) => <Tag key={k} icon={<CategoryIcon k={k} />}>{categoryLabel(k, lang)}</Tag>)}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-bg p-3"><p className="text-xs text-ink-muted">{t('wizard.bands')}</p><p className="font-semibold text-navy">{cr?.stats.followerBand ? t(`band.${cr.stats.followerBand}`) : '—'}</p></div>
        <div className="rounded-xl bg-bg p-3"><p className="text-xs text-ink-muted">{t('onboarding.engagement')}</p><p className="font-semibold text-accent">{cr?.stats.engagementRate != null ? `${cr.stats.engagementRate}%` : '—'}</p></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        {cr?.reels.map((r, n) => <ExternalLink key={r} href={r} className="inline-flex items-center gap-1"><Clapperboard className="h-3.5 w-3.5" />{t('campaign.viewReel', { n: n + 1 })}</ExternalLink>)}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
        <p className="font-display text-xl font-extrabold text-navy">{formatINR(i.brandPricePaise)}</p>
        {selectable && (
          <Button variant={picked ? 'primary' : 'secondary'} size="sm" aria-pressed={picked} onClick={onToggle} icon={picked ? <CheckCircle2 className="h-4 w-4" /> : undefined}>
            {picked ? t('campaign.selected') : t('campaign.select')}
          </Button>
        )}
      </div>
    </div>
  );
}

export function CampaignDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const qc = useQueryClient();
  const lang = i18n.language;
  const { paymentsEnabled } = useAppConfig();
  const campaign = useQuery({ queryKey: ['campaigns', id], queryFn: () => api.get<CampaignView>(`/campaigns/${id}`) });
  const shortlist = useQuery({ queryKey: ['campaigns', id, 'shortlist'], queryFn: () => api.get<ShortlistItemView[]>(`/campaigns/${id}/shortlist`), enabled: !!campaign.data && campaign.data.status !== 'DRAFT' });
  const deals = useQuery({ queryKey: ['deals'], queryFn: () => api.get<DealView[]>('/deals') });
  const checkout = useQuery({ queryKey: ['checkout', id], queryFn: () => api.get<CheckoutView>(`/campaigns/${id}/checkout`), enabled: paymentsEnabled && campaign.data?.status === 'PAYMENT_PENDING' });
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['campaigns'] }); void qc.invalidateQueries({ queryKey: ['deals'] }); };
  const select = useMutation({
    mutationFn: () => api.post(`/campaigns/${id}/shortlist/select`, { itemIds: picked }),
    onSuccess: () => { setPicked([]); refresh(); },
    onError: (e) => setError(errorText(t, e)),
  });
  const cancel = useMutation({
    mutationFn: () => api.post(`/campaigns/${id}/cancel`, { reason }),
    onSuccess: () => { setCancelling(false); refresh(); },
    onError: (e) => setError(errorText(t, e)),
  });

  if (campaign.isLoading || campaign.error) return <QueryState isLoading={campaign.isLoading} error={campaign.error} retry={() => campaign.refetch()} />;
  const c = campaign.data!;
  const items = shortlist.data ?? [];
  const total = items.filter((i) => picked.includes(i.id)).reduce((s, i) => s + i.brandPricePaise, 0);
  const myDeals = (deals.data ?? []).filter((d) => d.campaignId === c.id);
  const order = ['SUBMITTED', 'IN_REVIEW', 'SHORTLIST_SENT', 'CREATORS_SELECTED', 'PAYMENT_PENDING', 'ACTIVE', 'COMPLETED'];
  const at = order.indexOf(c.status);

  return (
    <div className="space-y-6">
      <Link to="/brand/campaigns" className="inline-flex items-center gap-1 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4" />{t('nav.campaigns')}</Link>
      <PageHeader title={c.title} subtitle={c.goal ? t(`goal.${c.goal}`) : undefined} action={<StatusBadge kind="campaign" status={c.status} />} />

      {c.status === 'PAYMENT_PENDING' && !paymentsEnabled && <Alert tone="blue">{t('campaign.awaitingStart')}</Alert>}
      {c.status === 'PAYMENT_PENDING' && paymentsEnabled && (
        <Card className={checkout.data?.pending ? 'border-info/30 bg-info-soft' : 'border-warning/30 bg-warning-soft'}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Wallet className={cx('h-6 w-6 shrink-0', checkout.data?.pending ? 'text-info' : 'text-warning')} aria-hidden="true" />
              <div>
                <p className="font-semibold text-navy">{checkout.data?.pending ? t('campaign.paymentPending') : t('campaign.paymentDue')}</p>
                {checkout.data && <p className="text-sm text-ink-muted">{t('payment.total')}: <strong>{formatINR(checkout.data.totalPaise)}</strong></p>}
              </div>
            </div>
            <Link to={`/brand/campaigns/${c.id}/payment`} className={primaryLink}>{checkout.data?.pending ? t('common.view') : t('campaign.payNow')}<ArrowRight className="h-4 w-4" /></Link>
          </div>
        </Card>
      )}

      {c.status !== 'CANCELLED' && (
        <Card>
          <Timeline items={['SUBMITTED', 'IN_REVIEW', 'SHORTLIST_SENT', 'PAYMENT_PENDING', 'ACTIVE'].map((s) => {
            const idx = order.indexOf(s);
            return { label: t(`status.campaign.${s}`), state: idx < at ? 'done' : idx === at || (s === 'PAYMENT_PENDING' && c.status === 'CREATORS_SELECTED') ? 'current' : 'todo' };
          })} />
        </Card>
      )}

      {['SUBMITTED', 'IN_REVIEW'].includes(c.status) && <Alert tone="blue">{t('campaign.waitingShortlist')}</Alert>}
      {error && <Alert tone="red">{error}</Alert>}

      {items.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-bold text-navy">{t('campaign.shortlist')}</h2>
          {c.status === 'SHORTLIST_SENT' && <p className="mb-4 mt-1 text-sm text-ink-muted">{t('campaign.shortlistText')}</p>}
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((i) => (
              <CreatorCardView key={i.id} i={i} selectable={c.status === 'SHORTLIST_SENT' && i.status === 'PROPOSED'} picked={picked.includes(i.id)}
                onToggle={() => setPicked((p) => (p.includes(i.id) ? p.filter((x) => x !== i.id) : [...p, i.id]))} />
            ))}
          </div>
          {c.status === 'SHORTLIST_SENT' && picked.length > 0 && (
            <div className="sticky bottom-20 z-20 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card bg-navy p-4 text-white shadow-lift lg:bottom-4">
              <p className="font-semibold">{t('campaign.total', { amount: formatINR(total) })}</p>
              <Button variant="accent" loading={select.isPending} onClick={() => select.mutate()}>{t('campaign.sendOffers', { n: picked.length })}</Button>
            </div>
          )}
        </section>
      )}

      {myDeals.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-xl font-bold text-navy">{t('campaign.deals')}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">
            {myDeals.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-3"><Avatar name={d.creator?.displayName} size="sm" /><p className="font-semibold text-navy">{d.creator?.displayName}</p></div>
                <div className="flex items-center gap-3">
                  {d.brandPricePaise != null && <span className="font-semibold">{formatINR(d.brandPricePaise)}</span>}
                  <StatusBadge kind="deal" status={d.status} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card>
        <CardHeader icon={<Megaphone />} title={t('campaign.details')} />
        <p className="whitespace-pre-line leading-relaxed">{c.description}</p>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-ink-muted">{t('wizard.categories')}</dt><dd className="mt-1 flex flex-wrap gap-1">{c.filters.categories.map((k) => <Tag key={k} icon={<CategoryIcon k={k} />}>{categoryLabel(k, lang)}</Tag>)}</dd></div>
          <div><dt className="text-ink-muted">{t('wizard.cities')}</dt><dd className="mt-1 font-medium">{c.filters.cities.map((k) => cityLabel(k, lang)).join(', ') || '—'}</dd></div>
          <div><dt className="text-ink-muted">{t('wizard.deliverables')}</dt><dd className="mt-1 font-medium">{c.deliverables.map((d) => `${d.quantity}× ${t(`deliverable.${d.type}`)}`).join(', ')}</dd></div>
          <div><dt className="text-ink-muted">{t('wizard.creatorsNeeded')}</dt><dd className="mt-1 font-medium">{c.creatorsNeeded}</dd></div>
          <div><dt className="text-ink-muted">{t('wizard.startDate')}</dt><dd className="mt-1 font-medium">{formatDate(c.startDate, lang)} – {formatDate(c.endDate, lang)}</dd></div>
          <div><dt className="text-ink-muted">{t('wizard.collabType')}</dt><dd className="mt-1 font-medium">{c.collabType ? t(`collab.${c.collabType}`) : '—'}</dd></div>
        </dl>
      </Card>

      {['SUBMITTED', 'IN_REVIEW', 'SHORTLIST_SENT', 'CREATORS_SELECTED', 'PAYMENT_PENDING'].includes(c.status) && (
        <div className="flex justify-end"><Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setCancelling(true)}>{t('campaign.cancel')}</Button></div>
      )}
      <Dialog open={cancelling} onClose={() => setCancelling(false)} title={t('campaign.cancel')}
        footer={<><Button variant="secondary" onClick={() => setCancelling(false)}>{t('common.back')}</Button><Button variant="danger" disabled={reason.trim().length < 3} loading={cancel.isPending} onClick={() => cancel.mutate()}>{t('common.confirm')}</Button></>}>
        <Field label={t('campaign.cancelReason')}>{(fid) => <Textarea id={fid} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </Dialog>
    </div>
  );
}

export function BrandDealsPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['deals'], queryFn: () => api.get<DealView[]>('/deals') });
  return (
    <div>
      <PageHeader title={t('deals.title')} subtitle={t('deals.subtitle')} />
      {q.isLoading || q.error ? <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} /> : q.data!.length === 0
        ? <EmptyState icon={<Handshake />} title={t('deals.none')} />
        : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">
            {q.data!.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-3">
                  <Avatar name={d.creator?.displayName} size="sm" />
                  <div><p className="font-semibold text-navy">{d.creator?.displayName}</p><p className="text-sm text-ink-muted">{d.campaignTitle}</p></div>
                </div>
                <div className="flex items-center gap-3">
                  {d.brandPricePaise != null && <span className="font-semibold">{formatINR(d.brandPricePaise)}</span>}
                  <StatusBadge kind="deal" status={d.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

