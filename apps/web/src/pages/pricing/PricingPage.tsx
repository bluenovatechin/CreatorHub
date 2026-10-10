/**
 * PRICING (/pricing): how fees work, WITHOUT numbers (product decision 2026-10-10): free for creators; brands get a
 * price per shortlisted creator with Bluenova's service fee already included, and arrange payment with the team.
 */
import { useTranslation } from 'react-i18next';
import { Briefcase, Check, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@bluenova/ui';
import { PageHero } from '../../components/marketing/PageHero';
import { usePageMeta } from '../../lib/seo';

function Plan({ icon, title, lead, points, cta, to }: { icon: JSX.Element; title: string; lead: string; points: string[]; cta: string; to: string }) {
  return (
    <Card className="flex flex-col">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">{icon}</span>
      <h2 className="mt-4 font-display text-xl font-extrabold text-navy">{title}</h2>
      <p className="mt-1 font-semibold text-accent">{lead}</p>
      <ul className="mt-4 space-y-2 text-sm">
        {points.map((p) => <li key={p} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />{p}</li>)}
      </ul>
      <Link to={to} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-ctl bg-primary px-5 font-semibold text-white shadow-btn hover:bg-primary-hover">{cta}</Link>
    </Card>
  );
}

export function PricingPage() {
  const { t } = useTranslation();
  usePageMeta({ title: t('nav.pricing'), description: t('meta.pricing') });
  return (
    <div>
      <PageHero eyebrow={t('nav.pricing')} title={t('pricing.title')} text={t('pricing.intro')} cta={t('pricing.ctaContact')} to="/contact" />
      <section className="mx-auto grid max-w-content gap-5 px-4 py-12 md:grid-cols-2">
        <Plan icon={<Sparkles />} title={t('pricing.creatorsTitle')} lead={t('pricing.creatorsLead')}
          points={[1, 2, 3].map((n) => t(`pricing.creators${n}`))} cta={t('home.ctaCreator')} to="/signup" />
        <Plan icon={<Briefcase />} title={t('pricing.brandsTitle')} lead={t('pricing.brandsLead')}
          points={[1, 2, 3, 4].map((n) => t(`pricing.brands${n}`))} cta={t('home.ctaBrand')} to="/signup" />
      </section>
      <p className="mx-auto max-w-content px-4 text-sm text-ink-muted">{t('pricing.note')}</p>
    </div>
  );
}
