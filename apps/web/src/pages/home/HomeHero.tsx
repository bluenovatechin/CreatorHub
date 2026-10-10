import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, Sparkles } from 'lucide-react';
import { primaryBtn, secondaryBtn } from '../../components/marketing/marketingStyles';
import { HeroVisual } from './HeroVisual';

export function HomeHero() {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden bg-hero-glow">
      <div className="mx-auto grid max-w-content items-center gap-14 px-4 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_1fr]">
        <div className="animate-fade-up">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-bold text-primary shadow-sm">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {t('home.eyebrow')}
          </p>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-navy sm:text-5xl lg:text-[56px]">
            {t('home.heroTitle')}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted">{t('home.heroText')}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/signup" className={primaryBtn}>
              {t('home.ctaCreator')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link to="/signup" className={secondaryBtn}>
              <Building2 className="h-4 w-4" aria-hidden="true" />
              {t('home.ctaBrand')}
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-muted">
            {[t('home.trust1'), t('home.trust2'), t('home.trust3')].map((x) => (
              <li key={x} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden="true" />
                {x}
              </li>
            ))}
          </ul>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}
