import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2 } from 'lucide-react';
import { primaryBtn, secondaryBtn } from '../../components/marketing/marketingStyles';

export function HomeCtaBanner() {
  const { t } = useTranslation();

  return (
    <section className="bg-hero-glow py-20">
      <div className="mx-auto max-w-content px-4 text-center">
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
          {t('home.ctaTitle')}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-muted">{t('home.ctaSubtitle')}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/signup" className={primaryBtn}>
            {t('home.ctaCreator')}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link to="/signup" className={secondaryBtn}>
            <Building2 className="h-4 w-4" aria-hidden="true" />
            {t('home.ctaBrand')}
          </Link>
        </div>
      </div>
    </section>
  );
}
