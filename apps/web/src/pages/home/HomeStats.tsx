/**
 * HOMEPAGE FACT STRIP: plain facts about the platform, counted from the real lists in packages/shared/src/catalog.ts
 * (never invented performance numbers).
 */
import { useTranslation } from 'react-i18next';
import { CATEGORIES, CITIES } from '@bluenova/shared';

export function HomeStats() {
  const { t } = useTranslation();
  const stats = [
    { v: String(CATEGORIES.length), l: t('home.stat1') },
    { v: String(CITIES.filter((c) => !c.key.startsWith('other_')).length), l: t('home.stat2') },
    { v: '100%', l: t('home.stat3') },
    { v: '2', l: t('home.stat4') },
  ];

  return (
    <section className="mx-auto -mt-6 max-w-content px-4">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.l} className="bg-white p-6 text-center">
            <dt className="order-2 mt-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">{s.l}</dt>
            <dd className="order-1 font-display text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">{s.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
