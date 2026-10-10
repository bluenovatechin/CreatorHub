import { useTranslation } from 'react-i18next';
import { CheckCircle2, Languages } from 'lucide-react';
import { CATEGORIES } from '@bluenova/shared';
import { CategoryIcon } from '../../components/icons';

export function CreatorPerksCard() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'gu' ? 'gu' : 'en';

  return (
    <div className="space-y-4">
      <div className="rounded-card bg-navy p-6 text-white">
        <h2 className="font-display text-xl font-bold">{t('forCreators.perks')}</h2>
        <ul className="mt-4 space-y-3">
          {(['perk1', 'perk2', 'perk3'] as const).map((k) => (
            <li key={k} className="flex items-center gap-3 text-primary-100">
              <CheckCircle2 className="h-5 w-5 text-accent" aria-hidden="true" />
              {t(`forCreators.${k}`)}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-card border border-line bg-white p-6 shadow-card">
        <h2 className="flex items-center gap-2 font-display font-bold text-navy">
          <Languages className="h-5 w-5 text-primary" aria-hidden="true" />
          {t('home.categoriesTitle')}
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <span
              key={c.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg px-3 py-1 text-xs font-semibold text-navy"
            >
              <span className="text-primary">
                <CategoryIcon k={c.key} />
              </span>
              {c[lang]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
