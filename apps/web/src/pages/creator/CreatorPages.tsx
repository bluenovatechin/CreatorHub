import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Calendar, CheckCircle2, Clapperboard, Gift, Handshake, Hash, Info, Mail, MapPin,
  Megaphone, Sparkles, Star, Wallet,
} from 'lucide-react';
import { OFFER_DECLINE_REASONS } from '@bluenova/shared';
import {
  Alert, Badge, Button, Card, CardHeader, Dialog, EmptyState, ExternalLink, Field, PageHeader, Select, StatCard, Tag,
  Textarea, Timeline, cx,
} from '@bluenova/ui';
import { api, errorText } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { categoryLabel, cityLabel, formatDate, formatINR } from '../../lib/format';
import type { CreatorSelf, DealView, OfferView, Opportunity } from '../../lib/types';
import { CategoryIcon } from '../../components/icons';
import { QueryState, SafetyTip, StatusBadge } from '../../components/common';

const useProfile = () => useQuery({ queryKey: ['creator', 'me'], queryFn: () => api.get<CreatorSelf>('/creators/me') });
const btn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-ctl px-4 text-sm font-semibold transition';

/* ---------- status (submitted / under review / decision) ---------- */

export function CreatorStatusPage() {
  const { t, i18n } = useTranslation();
  const q = useProfile();
  const qc = useQueryClient();
  const { reloadMe } = useAuth();
  const reapply = useMutation({
    mutationFn: () => api.post('/creators/me/reapply'),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['creator'] }); await reloadMe(); },
  });
  if (q.isLoading || q.error) return <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />;
  const p = q.data!;
  if (p.status === 'APPROVED') return <Navigate to="/creator" replace />;
  if (p.status === 'DRAFT') return <Navigate to={`/creator/onboarding/${p.onboardingStep}`} replace />;
  const submittedAt = p.statusHistory.filter((h) => h.to === 'SUBMITTED').at(-1)?.at;
  const decision = ['CHANGES_REQUESTED', 'REJECTED'].includes(p.status);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={t('creatorStatus.title')} action={<StatusBadge kind="creator" status={p.status} />} />
      <Card>
        <Timeline items={[
          { label: t('creatorStatus.submitted'), state: 'done', note: formatDate(submittedAt, i18n.language) },
          { label: t('creatorStatus.review'), state: p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW' ? 'current' : 'done', note: !decision ? t('creatorStatus.reviewNote') : undefined },
          { label: t('creatorStatus.decision'), state: p.status === 'REJECTED' ? 'failed' : decision ? 'current' : 'todo', note: decision ? t(`status.creator.${p.status}`) : undefined },
        ]} />
      </Card>
      {p.status === 'CHANGES_REQUESTED' && (
        <Card className="border-warning/40">
          <CardHeader icon={<Info />} title={t('creatorStatus.changesTitle')} />
          {p.review?.reasonCode && <Badge tone="amber">{t(`reviewReason.${p.review.reasonCode}`)}</Badge>}
          <p className="mt-3 whitespace-pre-line text-ink">{p.review?.reasonText}</p>
          <Link to="/creator/onboarding/1" className={cx(btn, 'mt-5 bg-primary text-white shadow-btn hover:bg-primary-hover')}>{t('creatorStatus.fixNow')}<ArrowRight className="h-4 w-4" /></Link>
        </Card>
      )}
      {p.status === 'REJECTED' && (
        <Card>
          {p.review?.reasonText && <p className="whitespace-pre-line">{p.review.reasonText}</p>}
          {p.reapplyAfter && new Date(p.reapplyAfter) > new Date()
            ? <p className="mt-3 text-sm text-ink-muted">{t('creatorStatus.rejectedNote', { date: formatDate(p.reapplyAfter, i18n.language) })}</p>
            : <Button className="mt-4" loading={reapply.isPending} onClick={() => reapply.mutate()}>{t('creatorStatus.reapply')}</Button>}
        </Card>
      )}
      <SafetyTip kind="otp" />
    </div>
  );
}

/* ---------- dashboard (approved creators) ---------- */

export function CreatorDashboard() {
  const { t } = useTranslation();
  const profile = useProfile();
  const offers = useQuery({ queryKey: ['offers'], queryFn: () => api.get<OfferView[]>('/offers') });
  const deals = useQuery({ queryKey: ['deals'], queryFn: () => api.get<DealView[]>('/deals') });
  if (profile.isLoading || profile.error) return <QueryState isLoading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} />;
  const p = profile.data!;
  if (p.status !== 'APPROVED') return <Navigate to="/creator/status" replace />;
  const intro = deals.data?.find((d) => d.type === 'INTRO_REEL');
  const openOffers = (offers.data ?? []).filter((o) => o.status === 'SENT');
  const brandDeals = (deals.data ?? []).filter((d) => d.type === 'BRAND');
  const active = brandDeals.filter((d) => !['COMPLETED', 'CANCELLED'].includes(d.status)).length;
  const done = brandDeals.filter((d) => d.status === 'COMPLETED').length;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[24px] bg-brand-gradient p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold"><BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />{t('creatorHome.partner')}</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold">{t('creatorHome.hello', { name: p.displayName ?? '' })}</h1>
        <p className="mt-1 text-primary-100">{t('creatorHome.subtitle')}</p>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Mail />} label={t('creatorHome.statOffers')} value={openOffers.length} tone="amber" />
        <StatCard icon={<Handshake />} label={t('creatorHome.statActive')} value={active} tone="teal" />
        <StatCard icon={<CheckCircle2 />} label={t('creatorHome.statDone')} value={done} tone="green" />
        <StatCard icon={<Star />} label={t('creatorHome.statScore')} value={p.creatorScore} />
      </div>

      {intro && !['VERIFIED', 'COMPLETED'].includes(intro.status) && (
        <Card className="border-primary-200 bg-primary-50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white"><Clapperboard className="h-6 w-6" aria-hidden="true" /></span>
              <div>
                <p className="font-display text-lg font-bold text-navy">{t('creatorHome.introTitle')}</p>
                <p className="text-sm text-ink-muted">{t('creatorHome.introText')}</p>
              </div>
            </div>
            <Link to="/creator/intro-reel" className={cx(btn, 'bg-primary text-white shadow-btn hover:bg-primary-hover')}>{t('creatorHome.introCta')}<ArrowRight className="h-4 w-4" /></Link>
          </div>
        </Card>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-navy">{t('creatorHome.offersTitle')}</h2>
          <Link to="/creator/offers" className="text-sm font-semibold text-primary hover:underline">{t('common.seeAll')}</Link>
        </div>
        {openOffers.length === 0
          ? <EmptyState icon={<Mail />} title={t('creatorHome.noOffers')} text={t('creatorHome.noOffersText')} />
          : <div className="grid gap-4 sm:grid-cols-2">{openOffers.map((o) => <OfferCard key={o.id} o={o} />)}</div>}
      </section>

      <section>
        <h2 className="mb-4 font-display text-xl font-bold text-navy">{t('creatorHome.dealsTitle')}</h2>
        {brandDeals.length === 0 ? <EmptyState icon={<Handshake />} title={t('creatorHome.noDeals')} /> : <DealList deals={brandDeals} />}
      </section>
    </div>
  );
}

/* ---------- intro reel brief ---------- */

export function IntroReelPage() {
  const { t } = useTranslation();
  const profile = useProfile();
  const [verb, setVerb] = useState<'m' | 'f'>('m');
  const [checked, setChecked] = useState<boolean[]>(Array(7).fill(false));
  if (profile.isLoading || profile.error) return <QueryState isLoading={profile.isLoading} error={profile.error} />;
  const p = profile.data!;
  if (p.status !== 'APPROVED') return <Navigate to="/creator/status" replace />;
  const joined = verb === 'm' ? 'જોડાઈ ગયો' : 'જોડાઈ ગઈ';
  const doneCount = checked.filter(Boolean).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/creator" className="inline-flex items-center gap-1 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4" />{t('nav.dashboard')}</Link>
      <PageHeader eyebrow="Bluenova Creator Hub" title={t('intro.title')} />
      <Card>
        <CardHeader icon={<Sparkles />} title={t('intro.concept')} />
        <p className="leading-relaxed">{t('intro.conceptText')}</p>
      </Card>
      <Card>
        <CardHeader icon={<Megaphone />} title={t('intro.script')} action={(
          <div className="flex rounded-full border border-line p-0.5 text-sm" role="group" aria-label={t('intro.verbToggle')}>
            {(['m', 'f'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={verb === v} onClick={() => setVerb(v)}
                className={cx('min-h-8 rounded-full px-3 font-semibold', verb === v ? 'bg-primary text-white' : 'text-ink-muted')}>{t(v === 'm' ? 'intro.verbM' : 'intro.verbF')}</button>
            ))}
          </div>
        )} />
        <blockquote lang="gu" className="space-y-2 rounded-2xl border-l-4 border-primary bg-primary-50 p-5 text-[17px] leading-8 text-navy">
          <p>“Hi everyone! હું છું <strong>{p.displayName}</strong> 👋</p>
          <p>અને હવે હું officially Bluenova Creator Hub સાથે Creator Partner તરીકે <strong>{joined}</strong> છું. ✨</p>
          <p>હવે brands અને creators વચ્ચે meaningful collaborations માટે હું Bluenova Creator Hub સાથે કામ કરીશ.</p>
          <p>જો તમે પણ તમારા brand સાથે collaboration કરવા માંગતા હો, તો stay connected with Bluenova Creator Hub. 🚀”</p>
        </blockquote>
      </Card>
      <Card>
        <CardHeader icon={<CheckCircle2 />} title={t('intro.checklist')} subtitle={t('intro.checklistNote')} action={<Badge tone={doneCount === 7 ? 'green' : 'grey'}>{doneCount}/7</Badge>} />
        <ul className="grid gap-2 sm:grid-cols-2">
          {[1, 2, 3, 4, 5, 6, 7].map((n, i) => (
            <li key={n}>
              <label className={cx('flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition', checked[i] ? 'border-accent bg-accent-soft' : 'border-line hover:border-primary-200')}>
                <input type="checkbox" className="mt-0.5 h-5 w-5 accent-primary" checked={checked[i]}
                  onChange={(e) => setChecked((c) => c.map((x, j) => (j === i ? e.target.checked : x)))} />
                <span className="text-sm">{t(`intro.c${n}`)}</span>
              </label>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader icon={<Info />} title={t('intro.important')} />
        <p className="leading-relaxed">{t('intro.importantText')}</p>
        <p className="mt-3 text-sm text-ink-muted">{t('intro.posting')}</p>
      </Card>
      <Alert tone={doneCount === 7 ? 'green' : 'blue'}>{t('intro.uploadSoon')}</Alert>
    </div>
  );
}

/* ---------- opportunities ---------- */

export function OpportunitiesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['opportunities'], queryFn: () => api.get<Opportunity[]>('/opportunities') });
  const toggle = useMutation({
    mutationFn: ({ id, interested }: { id: string; interested: boolean }) => api.post(`/opportunities/${id}/interest`, { interested }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunities'] }),
  });
  return (
    <div>
      <PageHeader title={t('opps.title')} subtitle={t('opps.subtitle')} />
      {q.isLoading || q.error ? <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} /> : q.data!.length === 0 ? (
        <EmptyState icon={<Sparkles />} title={t('opps.none')} text={t('opps.noneText')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {q.data!.map((o) => (
            <Card key={o.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">{o.companyName}</p>
                  <h2 className="mt-1 font-display text-lg font-bold text-navy">{o.title}</h2>
                </div>
                <Badge tone="blue">{t(`goal.${o.goal}`)}</Badge>
              </div>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted">{o.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {o.categories.map((c) => <Tag key={c} icon={<CategoryIcon k={c} />}>{categoryLabel(c, i18n.language)}</Tag>)}
                {o.cities.slice(0, 3).map((c) => <Tag key={c} icon={<MapPin />}>{cityLabel(c, i18n.language)}</Tag>)}
                {o.deliverables.map((d) => <Tag key={d.type} icon={<Clapperboard />}>{d.quantity}× {t(`deliverable.${d.type}`)}</Tag>)}
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
                <p className="flex items-center gap-1.5 text-xs text-ink-muted"><Calendar className="h-3.5 w-3.5" />{formatDate(o.startDate, i18n.language)} – {formatDate(o.endDate, i18n.language)}</p>
                <Button variant={o.interested ? 'accent' : 'secondary'} size="sm" aria-pressed={o.interested}
                  loading={toggle.isPending && toggle.variables?.id === o.id}
                  icon={o.interested ? <CheckCircle2 className="h-4 w-4" /> : undefined}
                  onClick={() => toggle.mutate({ id: o.id, interested: !o.interested })}>
                  {o.interested ? t('opps.interested') : t('opps.markInterested')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- offers ---------- */

function OfferCard({ o }: { o: OfferView }) {
  const { t, i18n } = useTranslation();
  return (
    <Link to={`/creator/offers/${o.id}`} className="group block rounded-card border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lift">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">{o.companyName}</p>
          <p className="mt-1 font-display font-bold text-navy">{o.campaign?.title}</p>
        </div>
        <StatusBadge kind="offer" status={o.status} />
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-ink-muted">{t('offers.payout')}</p>
          <p className="font-display text-2xl font-extrabold text-accent">{formatINR(o.payoutPaise)}</p>
        </div>
        <ArrowRight className="h-5 w-5 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
      </div>
      {o.status === 'SENT' && <p className="mt-2 text-xs font-semibold text-warning">{t('offers.expires', { date: formatDate(o.expiresAt, i18n.language) })}</p>}
    </Link>
  );
}

export function OffersPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['offers'], queryFn: () => api.get<OfferView[]>('/offers') });
  return (
    <div>
      <PageHeader title={t('offers.title')} subtitle={t('offers.subtitle')} />
      {q.isLoading || q.error ? <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} /> : q.data!.length === 0
        ? <EmptyState icon={<Mail />} title={t('offers.none')} text={t('creatorHome.noOffersText')} />
        : <div className="grid gap-4 sm:grid-cols-2">{q.data!.map((o) => <OfferCard key={o.id} o={o} />)}</div>}
    </div>
  );
}

export function OfferDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['offers', id], queryFn: () => api.get<OfferView>(`/offers/${id}`) });
  const [confirming, setConfirming] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState<string>('busy');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const act = useMutation({
    mutationFn: (action: 'accept' | 'decline') => api.post<OfferView>(`/offers/${id}/${action}`, action === 'decline' ? { reason, note: note || undefined } : {}),
    onSuccess: (data) => {
      qc.setQueryData(['offers', id], data);
      void qc.invalidateQueries({ queryKey: ['offers'] });
      void qc.invalidateQueries({ queryKey: ['deals'] });
      setConfirming(false);
      setDeclining(false);
    },
    onError: (e) => setError(errorText(t, e)),
  });
  if (q.isLoading || q.error) return <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />;
  const o = q.data!;
  const lang = i18n.language;
  const list = (title: string, items: string[]) => items.length > 0 && (
    <div><p className="text-sm font-bold text-navy">{title}</p><ul className="mt-1 space-y-1 text-sm">{items.map((x) => <li key={x} className="flex gap-2"><span className="text-primary">•</span>{x}</li>)}</ul></div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/creator/offers" className="inline-flex items-center gap-1 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4" />{t('offers.title')}</Link>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{o.companyName}</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold text-navy">{o.campaign?.title}</h1>
          </div>
          <StatusBadge kind="offer" status={o.status} />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-accent-soft p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-800"><Wallet className="h-3.5 w-3.5" />{t('offers.payout')}</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-accent">{formatINR(o.payoutPaise)}</p>
          </div>
          <div className="rounded-2xl bg-bg p-4">
            <p className="text-xs font-semibold text-ink-muted">{t('offers.draftDue')}</p>
            <p className="mt-1 font-bold text-navy">{formatDate(o.deadlines.draftDue, lang)}</p>
          </div>
          <div className="rounded-2xl bg-bg p-4">
            <p className="text-xs font-semibold text-ink-muted">{t('offers.liveDue')}</p>
            <p className="mt-1 font-bold text-navy">{formatDate(o.deadlines.liveDue, lang)}</p>
          </div>
        </div>
        {o.campaign?.product && <p className="mt-4 flex items-center gap-2 text-sm"><Gift className="h-4 w-4 text-primary" />{t('offers.product')}: <strong>{o.campaign.product.name}</strong></p>}
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-primary-50 p-3 text-sm text-navy"><Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{t('offers.payoutNote')}</p>
      </Card>

      <Card>
        <CardHeader icon={<Megaphone />} title={t('offers.brief')} />
        <p className="whitespace-pre-line leading-relaxed">{o.brief.description}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">{o.deliverables.map((d) => <Tag key={d.type} icon={<Clapperboard />}>{d.quantity}× {t(`deliverable.${d.type}`)}</Tag>)}</div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {list(t('offers.dos'), o.brief.dos)}
          {list(t('offers.donts'), o.brief.donts)}
        </div>
        {(o.brief.hashtags.length > 0 || o.brief.mentions.length > 0) && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {o.brief.hashtags.map((h) => <Tag key={h} icon={<Hash />}>{h.replace('#', '')}</Tag>)}
            {o.brief.mentions.map((m) => <Tag key={m}>{m}</Tag>)}
          </div>
        )}
        {o.brief.referenceUrls.length > 0 && <div className="mt-4 space-y-1">{o.brief.referenceUrls.map((u) => <p key={u} className="text-sm"><ExternalLink href={u}>{u}</ExternalLink></p>)}</div>}
        <div className="mt-5"><Alert tone="amber">{t('offers.disclosure')}</Alert></div>
      </Card>

      {o.status === 'ACCEPTED' && <Alert tone="green">{t('offers.accepted')}</Alert>}
      {error && <Alert tone="red">{error}</Alert>}

      {o.status === 'SENT' && (
        <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-card border border-line bg-white p-4 shadow-lift sm:flex-row sm:justify-end lg:bottom-4">
          <Button variant="secondary" size="lg" onClick={() => setDeclining(true)}>{t('offers.decline')}</Button>
          <Button variant="accent" size="lg" icon={<CheckCircle2 className="h-5 w-5" />} onClick={() => setConfirming(true)}>{t('offers.accept')}</Button>
        </div>
      )}

      <Dialog open={confirming} onClose={() => setConfirming(false)} title={t('offers.accept')}
        footer={<><Button variant="secondary" onClick={() => setConfirming(false)}>{t('common.cancel')}</Button><Button variant="accent" loading={act.isPending} onClick={() => act.mutate('accept')}>{t('common.confirm')}</Button></>}>
        <p className="text-sm leading-relaxed">{t('offers.acceptConfirm')}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t('offers.payoutNote')}</p>
      </Dialog>

      <Dialog open={declining} onClose={() => setDeclining(false)} title={t('offers.declineTitle')}
        footer={<><Button variant="secondary" onClick={() => setDeclining(false)}>{t('common.cancel')}</Button><Button variant="danger" loading={act.isPending} onClick={() => act.mutate('decline')}>{t('offers.decline')}</Button></>}>
        <div className="space-y-4">
          <Field label={t('offers.declineTitle')}>
            {(fid) => <Select id={fid} value={reason} onChange={(e) => setReason(e.target.value)}>{OFFER_DECLINE_REASONS.map((r) => <option key={r} value={r}>{t(`declineReason.${r}`)}</option>)}</Select>}
          </Field>
          <Field label={t('offers.note')}>{(fid) => <Textarea id={fid} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
        </div>
      </Dialog>
      <SafetyTip />
    </div>
  );
}

/* ---------- deals ---------- */

function DealList({ deals }: { deals: DealView[] }) {
  const { t, i18n } = useTranslation();
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">
      {deals.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">{d.type === 'INTRO_REEL' ? <Clapperboard className="h-5 w-5" /> : <Handshake className="h-5 w-5" />}</span>
            <div>
              <p className="font-semibold text-navy">{d.type === 'INTRO_REEL' ? t('dealType.INTRO_REEL') : d.campaignTitle}</p>
              <p className="text-sm text-ink-muted">
                {d.companyName ?? 'Bluenova'}{d.deadlines?.liveDue ? ` · ${t('common.due', { date: formatDate(d.deadlines.liveDue, i18n.language) })}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {d.creatorPayoutPaise != null && <span className="font-display font-bold text-accent">{formatINR(d.creatorPayoutPaise)}</span>}
            <StatusBadge kind="deal" status={d.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CreatorDealsPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['deals'], queryFn: () => api.get<DealView[]>('/deals') });
  return (
    <div>
      <PageHeader title={t('deals.title')} subtitle={t('deals.subtitle')} />
      {q.isLoading || q.error ? <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} /> : q.data!.length === 0
        ? <EmptyState icon={<Handshake />} title={t('deals.none')} />
        : <DealList deals={q.data!} />}
    </div>
  );
}
