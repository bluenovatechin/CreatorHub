import { useTranslation } from 'react-i18next';
import { CATEGORIES } from '@bluenova/shared';
import { CategoryIcon } from '../../components/icons';
import { SectionHead } from '../../components/marketing/SectionHead';

export function HomeCategories() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'gu' ? 'gu' : 'en';

  return (
    <section className="mx-auto max-w-content px-4 py-20">
      <SectionHead eyebrow={t('home.categoriesEyebrow')} title={t('home.categoriesTitle')} subtitle={t('home.categoriesSubtitle')} />
      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        {CATEGORIES.map((c) => (
          <div
            key={c.key}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-white p-4 text-center shadow-sm transition hover:border-primary-200 hover:shadow-card"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <CategoryIcon k={c.key} />
            </span>
            <span className="text-xs font-semibold text-navy">{c[lang]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
