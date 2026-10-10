import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

export function BrandDashboardHero({ companyName }: { companyName?: string }) {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden rounded-[24px] bg-brand-gradient p-6 text-white sm:p-8">
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{t('brandHome.hello', { name: companyName ?? '' })}</h1>
          <p className="mt-1 text-primary-100">{t('brandHome.subtitle')}</p>
        </div>
        <Link
          to="/brand/campaigns/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-ctl bg-white px-4 text-sm font-semibold text-navy shadow-sm hover:bg-primary-50"
        >
          <Plus className="h-4 w-4" />
          {t('brandHome.newCampaign')}
        </Link>
      </div>
    </section>
  );
}
