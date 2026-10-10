/**
 * HOW IT WORKS (/how-it-works): the managed process for creators and brands (HomeHowItWorks tabs) and what the
 * Bluenova team does at every step. Facts about the process only: no invented numbers or testimonials.
 */
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { PageHero } from '../../components/marketing/PageHero';
import { usePageMeta } from '../../lib/seo';
import { HomeHowItWorks } from '../home/HomeHowItWorks';

export function HowItWorksPage() {
  const { t } = useTranslation();
  usePageMeta({ title: t('nav.howItWorks'), description: t('meta.how') });
  const team = [1, 2, 3, 4, 5].map((n) => t(`howPage.team${n}`));
  return (
    <div>
      <PageHero eyebrow={t('nav.howItWorks')} title={t('howPage.title')} text={t('howPage.intro')} cta={t('howPage.cta')} to="/signup" />
      <HomeHowItWorks />
      <section className="mx-auto max-w-content px-4 py-12">
        <h2 className="font-display text-2xl font-extrabold text-navy">{t('howPage.teamTitle')}</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {team.map((x) => (
            <li key={x} className="flex gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
