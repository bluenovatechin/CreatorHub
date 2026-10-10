/**
 * FOR BRANDS PAGE (/for-brands)
 */
import { useTranslation } from 'react-i18next';
import { PageHero } from '../../components/marketing/PageHero';
import { BrandWorkflowSteps } from './BrandWorkflowSteps';
import { BrandPaymentSafetyCard } from './BrandPaymentSafetyCard';
import './ForBrandsPage.css';
import { usePageMeta } from '../../lib/seo';

export function ForBrandsPage() {
  const { t } = useTranslation();
  usePageMeta({ title: t('nav.forBrands'), description: t('meta.forBrands') });

  return (
    <div className="for-brands-page">
      <PageHero
        eyebrow={t('forBrands.eyebrow')}
        title={t('forBrands.title')}
        text={t('forBrands.intro')}
        cta={t('forBrands.cta')}
        to="/signup"
      />
      <section className="mx-auto max-w-content px-4 py-14">
        <BrandWorkflowSteps />
        <BrandPaymentSafetyCard />
      </section>
    </div>
  );
}
