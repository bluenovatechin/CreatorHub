/**
 * FOR CREATORS PAGE (/for-creators)
 */
import { useTranslation } from 'react-i18next';
import { PageHero } from '../../components/marketing/PageHero';
import { CreatorProcessList } from './CreatorProcessList';
import { CreatorPerksCard } from './CreatorPerksCard';
import './ForCreatorsPage.css';
import { usePageMeta } from '../../lib/seo';

export function ForCreatorsPage() {
  const { t } = useTranslation();
  usePageMeta({ title: t('nav.forCreators'), description: t('meta.forCreators') });

  return (
    <div className="for-creators-page">
      <PageHero
        eyebrow={t('forCreators.eyebrow')}
        title={t('forCreators.title')}
        text={t('forCreators.intro')}
        cta={t('forCreators.cta')}
        to="/signup"
      />
      <section className="mx-auto grid max-w-content gap-8 px-4 py-14 lg:grid-cols-[1.3fr_1fr]">
        <CreatorProcessList />
        <CreatorPerksCard />
      </section>
    </div>
  );
}
