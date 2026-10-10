import { useTranslation } from 'react-i18next';
import { BadgeCheck } from 'lucide-react';

export function CreatorDashboardHero({ displayName }: { displayName?: string }) {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden rounded-[24px] bg-brand-gradient p-6 text-white sm:p-8">
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
      <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
        <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
        {t('creatorHome.partner')}
      </p>
      <h1 className="mt-3 font-display text-3xl font-extrabold">{t('creatorHome.hello', { name: displayName ?? '' })}</h1>
      <p className="mt-1 text-primary-100">{t('creatorHome.subtitle')}</p>
    </section>
  );
}
