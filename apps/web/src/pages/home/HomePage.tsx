/**
 * HOME PAGE (/)
 * Composed of clean modular section components.
 */
import { useTranslation } from 'react-i18next';
import { SectionHead } from '../../components/marketing/SectionHead';
import { HomeHero } from './HomeHero';
import { HomeStats } from './HomeStats';
import { HomeWhyUs } from './HomeWhyUs';
import { HomeHowItWorks } from './HomeHowItWorks';
import { HomeCategories } from './HomeCategories';
import { HomePaymentSafety } from './HomePaymentSafety';
import { FaqSection } from './FaqSection';
import { HomeCtaBanner } from './HomeCtaBanner';
import './HomePage.css';
import { usePageMeta } from '../../lib/seo';

export function HomePage() {
  const { t } = useTranslation();
  usePageMeta({ description: t('meta.home') });

  return (
    <div className="home-page">
      <HomeHero />
      <HomeStats />
      <HomeWhyUs />
      <HomeHowItWorks />
      <HomeCategories />
      <HomePaymentSafety />
      <section className="mx-auto max-w-content px-4 py-20">
        <SectionHead eyebrow={t('home.faqEyebrow')} title={t('home.faqTitle')} />
        <FaqSection />
      </section>
      <HomeCtaBanner />
    </div>
  );
}
