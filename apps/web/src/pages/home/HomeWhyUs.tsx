import { useTranslation } from 'react-i18next';
import { BadgeCheck, Clapperboard, MapPin, ShieldCheck } from 'lucide-react';
import { SectionHead } from '../../components/marketing/SectionHead';

export function HomeWhyUs() {
  const { t } = useTranslation();
  const why = [
    { icon: BadgeCheck, k: 'why1' },
    { icon: ShieldCheck, k: 'why2' },
    { icon: Clapperboard, k: 'why3' },
    { icon: MapPin, k: 'why4' },
  ];

  return (
    <section className="mx-auto max-w-content px-4 py-20">
      <SectionHead eyebrow={t('home.whyEyebrow')} title={t('home.whyTitle')} subtitle={t('home.whySubtitle')} />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {why.map(({ icon: Icon, k }) => (
          <div key={k} className="group relative rounded-card border border-line bg-white p-7 shadow-card transition hover:-translate-y-1 hover:shadow-card-hover">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary transition group-hover:bg-primary group-hover:text-white">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="mt-5 font-display text-lg font-bold text-navy">{t(`home.${k}`)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t(`home.${k}t`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
