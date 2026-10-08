import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Banknote, Building2, CheckCircle2, ChevronDown, ClipboardList, Clapperboard, Eye, Film,
  Handshake, Instagram, Landmark, Languages, LayoutGrid, Lock, MapPin, SearchCheck, ShieldCheck, Sparkles, UserPlus, Wallet,
} from 'lucide-react';
import { CATEGORIES } from '@bluenova/shared';
import { cx } from '@bluenova/ui';
import { CategoryIcon } from '../../components/icons';
import { useAppConfig } from '../../lib/config';

const primaryBtn = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-ctl bg-primary px-6 font-semibold text-white shadow-btn transition hover:bg-primary-hover';
const secondaryBtn = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-ctl border border-line-strong bg-white px-6 font-semibold text-navy transition hover:border-primary-300 hover:bg-primary-50';

function SectionHead({ eyebrow, title, text, center = true }: { eyebrow?: string; title: string; text?: string; center?: boolean }) {
  return (
    <div className={cx('max-w-2xl', center && 'mx-auto text-center')}>
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>}
      <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">{title}</h2>
      {text && <p className="mt-3 text-ink-muted">{text}</p>}
    </div>
  );
}

/** Illustrative product preview built in HTML (no stock photos). */
function HeroVisual() {
  const { t } = useTranslation();
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-primary-200/60 via-white to-accent-soft blur-2xl" />
      <div className="relative rounded-[24px] border border-white/70 bg-white/90 p-6 shadow-lift backdrop-blur">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sun to-danger text-white"><Sparkles className="h-7 w-7" /></span>
          <div>
            <p className="font-display text-lg font-extrabold text-navy">{t('home.mockCard.name')}</p>
            <p className="text-sm text-ink-muted">{t('home.mockCard.role')}</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary"><BadgeCheck className="h-3.5 w-3.5" />{t('home.mockCard.partner')}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-bg p-3"><p className="text-xs text-ink-muted">{t('home.mockCard.followers')}</p><p className="font-display text-xl font-extrabold text-navy">48.2K</p></div>
          <div className="rounded-2xl bg-bg p-3"><p className="text-xs text-ink-muted">{t('home.mockCard.engagement')}</p><p className="font-display text-xl font-extrabold text-accent">5.4%</p></div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {['from-primary-400 to-primary-700', 'from-accent to-primary-500', 'from-sun to-primary-400'].map((g) => (
            <div key={g} className={cx('flex aspect-[9/14] items-end rounded-xl bg-gradient-to-br p-2', g)}><Film className="h-4 w-4 text-white/90" /></div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-6 -left-4 flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-lift sm:-left-10">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 className="h-5 w-5" /></span>
        <div><p className="text-sm font-bold text-navy">{t('home.mockCard.toast')}</p><p className="text-xs text-ink-muted">{t('home.mockCard.toastText')}</p></div>
      </div>
      <div className="absolute -right-3 -top-5 flex items-center gap-2 rounded-2xl border border-line bg-white px-3 py-2 shadow-lift sm:-right-8">
        <Instagram className="h-4 w-4 text-danger" /><span className="text-xs font-bold text-navy">#ad · Reel</span>
      </div>
    </div>
  );
}

function Faq() {
  const { t } = useTranslation();
  const { paymentsEnabled } = useAppConfig();
  const base = t('home.faq', { returnObjects: true }) as { q: string; a: string }[];
  const items = paymentsEnabled ? [...base.slice(0, 1), t('home.faqPayment', { returnObjects: true }) as { q: string; a: string }, ...base.slice(1)] : base;
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto mt-10 max-w-3xl divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">
      {items.map((it, i) => (
        <div key={it.q}>
          <h3>
            <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-semibold text-navy hover:bg-bg">
              {it.q}<ChevronDown className={cx('h-5 w-5 shrink-0 text-ink-muted transition', open === i && 'rotate-180')} aria-hidden="true" />
            </button>
          </h3>
          {open === i && <p className="px-6 pb-5 leading-relaxed text-ink-muted">{it.a}</p>}
        </div>
      ))}
    </div>
  );
}

export function HomePage() {
  const { t, i18n } = useTranslation();
  const { paymentsEnabled } = useAppConfig();
  const lang = i18n.language === 'gu' ? 'gu' : 'en';
  const [tab, setTab] = useState<'creators' | 'brands'>('creators');
  const creatorSteps = [
    { icon: UserPlus, t: t('forCreators.p1'), d: t('forCreators.p1t') },
    { icon: LayoutGrid, t: t('forCreators.p2'), d: t('forCreators.p2t') },
    { icon: Clapperboard, t: t('forCreators.p3'), d: t('forCreators.p3t') },
    { icon: SearchCheck, t: t('forCreators.p4'), d: t('forCreators.p4t') },
    { icon: Handshake, t: t('forCreators.p5'), d: t('forCreators.p5t') },
  ];
  const brandSteps = [
    { icon: ClipboardList, t: t('forBrands.s1'), d: t('forBrands.s1t') },
    { icon: SearchCheck, t: t('forBrands.s2'), d: t('forBrands.s2t') },
    { icon: Wallet, t: t('forBrands.s3'), d: t('forBrands.s3t') },
    { icon: Eye, t: t('forBrands.s4'), d: t('forBrands.s4t') },
  ];
  const steps = tab === 'creators' ? creatorSteps : brandSteps;
  const stats = [
    { v: '16', l: t('home.stat1') }, { v: '20+', l: t('home.stat2') }, { v: '100%', l: t('home.stat3') }, { v: '2', l: t('home.stat4') },
  ];
  const why = [
    { icon: BadgeCheck, k: 'why1' }, { icon: ShieldCheck, k: 'why2' }, { icon: Clapperboard, k: 'why3' }, { icon: MapPin, k: 'why4' },
  ];
  const pay = [
    { icon: Landmark, k: 'pay1' }, { icon: SearchCheck, k: 'pay2' }, { icon: Clapperboard, k: 'pay3' }, { icon: Banknote, k: 'pay4' },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-hero-glow">
        <div className="mx-auto grid max-w-content items-center gap-14 px-4 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_1fr]">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-bold text-primary shadow-sm">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{t('home.eyebrow')}
            </p>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-navy sm:text-5xl lg:text-[56px]">{t('home.heroTitle')}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted">{t('home.heroText')}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/signup?role=creator" className={primaryBtn}>{t('home.ctaCreator')}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <Link to="/signup?role=brand" className={secondaryBtn}><Building2 className="h-4 w-4" aria-hidden="true" />{t('home.ctaBrand')}</Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-muted">
              {[t('home.trust1'), t('home.trust2'), t('home.trust3')].map((x) => (
                <li key={x} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-accent" aria-hidden="true" />{x}</li>
              ))}
            </ul>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto -mt-6 max-w-content px-4">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l} className="bg-white px-6 py-6 text-center">
              <dt className="order-2 mt-1 text-sm text-ink-muted">{s.l}</dt>
              <dd className="font-display text-3xl font-extrabold text-primary">{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-content px-4 py-20" id="how">
        <SectionHead eyebrow={t('home.howEyebrow')} title={t('home.howTitle')} />
        <div className="mx-auto mt-8 flex w-fit rounded-full border border-line bg-white p-1 shadow-sm" role="tablist">
          {(['creators', 'brands'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cx('min-h-10 rounded-full px-5 text-sm font-bold transition', tab === k ? 'bg-primary text-white shadow-btn' : 'text-ink-muted hover:text-navy')}>
              {t(k === 'creators' ? 'home.tabCreators' : 'home.tabBrands')}
            </button>
          ))}
        </div>
        <ol className={cx('mt-10 grid gap-4', tab === 'creators' ? 'md:grid-cols-5' : 'md:grid-cols-4')}>
          {steps.map(({ icon: Icon, t: title, d }, i) => (
            <li key={title} className="relative rounded-card border border-line bg-white p-5 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <p className="mt-4 text-xs font-bold text-primary">0{i + 1}</p>
              <p className="mt-1 font-display font-bold leading-snug text-navy">{title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 text-center">
          <Link to={tab === 'creators' ? '/signup?role=creator' : '/signup?role=brand'} className={primaryBtn}>
            {tab === 'creators' ? t('forCreators.cta') : t('forBrands.cta')}<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Categories */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-content px-4">
          <SectionHead eyebrow={t('home.categoriesEyebrow')} title={t('home.categoriesTitle')} text={t('home.categoriesText')} />
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {CATEGORIES.map((c) => (
              <li key={c.key} className="group flex flex-col items-center gap-2 rounded-2xl border border-line bg-bg px-3 py-5 text-center transition hover:-translate-y-0.5 hover:border-primary-200 hover:bg-white hover:shadow-card">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-primary shadow-sm group-hover:bg-primary group-hover:text-white"><CategoryIcon k={c.key} className="h-5 w-5" /></span>
                <span className="text-sm font-semibold text-navy">{c[lang]}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Why */}
      <section className="mx-auto max-w-content px-4 py-20">
        <SectionHead title={t('home.whyTitle')} />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {why.map(({ icon: Icon, k }) => (
            <div key={k} className="rounded-card border border-line bg-white p-6 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <p className="mt-4 font-display font-bold text-navy">{t(`home.${k}`)}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{t(`home.${k}t`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Payments (only when the payment feature is switched on) */}
      {paymentsEnabled && <section className="mx-auto max-w-content px-4">
        <div className="overflow-hidden rounded-[28px] bg-brand-gradient p-8 text-white sm:p-12">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-200">{t('home.payEyebrow')}</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">{t('home.payTitle')}</h2>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {pay.map(({ icon: Icon, k }, i) => (
              <li key={k} className="rounded-2xl bg-white/10 p-5 ring-1 ring-inset ring-white/15">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                  <span className="text-xs font-bold text-primary-200">0{i + 1}</span>
                </div>
                <p className="mt-4 font-display font-bold">{t(`home.${k}`)}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-primary-100">{t(`home.${k}t`)}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 flex items-center gap-2 text-sm text-primary-100"><Lock className="h-4 w-4" aria-hidden="true" />{t('safety.payment')}</p>
        </div>
      </section>}

      {/* FAQ */}
      <section className="mx-auto max-w-content px-4 py-20">
        <SectionHead eyebrow="FAQ" title={t('home.faqTitle')} />
        <Faq />
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-content px-4">
        <div className="flex flex-col items-center justify-between gap-6 rounded-[28px] border border-primary-100 bg-primary-50 p-8 text-center sm:p-12 md:flex-row md:text-left">
          <div>
            <h2 className="font-display text-3xl font-extrabold text-navy">{t('home.ctaTitle')}</h2>
            <p className="mt-2 text-ink-muted">{t('home.ctaText')}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/signup?role=creator" className={primaryBtn}>{t('home.ctaCreator')}</Link>
            <Link to="/signup?role=brand" className={secondaryBtn}>{t('home.ctaBrand')}</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function PageHero({ eyebrow, title, text, cta, to }: { eyebrow: string; title: string; text: string; cta: string; to: string }) {
  return (
    <section className="bg-hero-glow">
      <div className="mx-auto max-w-content px-4 py-16 sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-tight tracking-tight text-navy sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-muted">{text}</p>
        <Link to={to} className={cx(primaryBtn, 'mt-8')}>{cta}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
    </section>
  );
}

export function ForCreatorsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'gu' ? 'gu' : 'en';
  const steps = ['p1', 'p2', 'p3', 'p4', 'p5'] as const;
  return (
    <>
      <PageHero eyebrow={t('forCreators.eyebrow')} title={t('forCreators.title')} text={t('forCreators.intro')} cta={t('forCreators.cta')} to="/signup?role=creator" />
      <section className="mx-auto grid max-w-content gap-8 px-4 py-14 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-card border border-line bg-white p-6 shadow-card sm:p-8">
          <h2 className="font-display text-2xl font-extrabold text-navy">{t('forCreators.processTitle')}</h2>
          <ol className="mt-6 space-y-5">
            {steps.map((k, i) => (
              <li key={k} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white">{i + 1}</span>
                <div><p className="font-semibold text-navy">{t(`forCreators.${k}`)}</p><p className="text-sm text-ink-muted">{t(`forCreators.${k}t`)}</p></div>
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-4">
          <div className="rounded-card bg-navy p-6 text-white">
            <h2 className="font-display text-xl font-bold">{t('forCreators.perks')}</h2>
            <ul className="mt-4 space-y-3">
              {(['perk1', 'perk2', 'perk3'] as const).map((k) => (
                <li key={k} className="flex items-center gap-3 text-primary-100"><CheckCircle2 className="h-5 w-5 text-accent" aria-hidden="true" />{t(`forCreators.${k}`)}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-card border border-line bg-white p-6 shadow-card">
            <h2 className="flex items-center gap-2 font-display font-bold text-navy"><Languages className="h-5 w-5 text-primary" aria-hidden="true" />{t('home.categoriesTitle')}</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-1.5 rounded-full bg-bg px-3 py-1.5 text-sm font-medium text-navy ring-1 ring-inset ring-line"><CategoryIcon k={c.key} className="h-3.5 w-3.5 text-primary" />{c[lang]}</span>
              ))}
            </div>
            <p className="mt-4 text-sm text-ink-muted">{t('forCreators.note')}</p>
          </div>
        </div>
      </section>
    </>
  );
}

export function ForBrandsPage() {
  const { t } = useTranslation();
  const { paymentsEnabled } = useAppConfig();
  const steps = [
    { icon: ClipboardList, k: 's1' }, { icon: SearchCheck, k: 's2' }, { icon: Wallet, k: 's3' }, { icon: Eye, k: 's4' },
  ];
  return (
    <>
      <PageHero eyebrow={t('forBrands.eyebrow')} title={t('forBrands.title')} text={t('forBrands.intro')} cta={t('forBrands.cta')} to="/signup?role=brand" />
      <section className="mx-auto max-w-content px-4 py-14">
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, k }, i) => (
            <li key={k} className="rounded-card border border-line bg-white p-6 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <p className="mt-4 text-xs font-bold text-primary">0{i + 1}</p>
              <p className="mt-1 font-display font-bold text-navy">{t(`forBrands.${k}`)}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{t(`forBrands.${k}t`)}</p>
            </li>
          ))}
        </ol>
        {paymentsEnabled && <div className="mt-10 rounded-card border border-line bg-white p-6 shadow-card sm:p-8">
          <h2 className="font-display text-2xl font-extrabold text-navy">{t('home.payTitle')}</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {(['pay1', 'pay2', 'pay3', 'pay4'] as const).map((k, i) => (
              <div key={k}><p className="text-xs font-bold text-primary">0{i + 1}</p><p className="mt-1 font-semibold text-navy">{t(`home.${k}`)}</p><p className="mt-1 text-sm text-ink-muted">{t(`home.${k}t`)}</p></div>
            ))}
          </div>
        </div>}
      </section>
    </>
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="font-display text-7xl font-extrabold text-primary-200">404</p>
      <h1 className="mt-4 font-display text-2xl font-extrabold text-navy">{t('notFound.title')}</h1>
      <p className="mt-2 text-ink-muted">{t('notFound.text')}</p>
      <Link to="/" className={cx(primaryBtn, 'mt-8')}>{t('notFound.home')}</Link>
    </div>
  );
}
