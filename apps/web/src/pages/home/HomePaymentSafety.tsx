import { useTranslation } from 'react-i18next';
import { Banknote, Clapperboard, Landmark, SearchCheck } from 'lucide-react';
import { useAppConfig } from '../../lib/config';

export function HomePaymentSafety() {
  const { t } = useTranslation();
  const { paymentsEnabled } = useAppConfig();
  // Payments are switched off (product decision): this section only appears if they are ever switched on.
  if (!paymentsEnabled) return null;
  const pay = [
    { icon: Landmark, k: 'pay1' },
    { icon: SearchCheck, k: 'pay2' },
    { icon: Clapperboard, k: 'pay3' },
    { icon: Banknote, k: 'pay4' },
  ];

  return (
    <section className="bg-navy py-20 text-white">
      <div className="mx-auto max-w-content px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">{t('home.payEyebrow')}</p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t('home.payTitle')}</h2>
          <p className="mt-3 text-base leading-relaxed text-primary-100">{t('home.paySubtitle')}</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pay.map(({ icon: Icon, k }, i) => (
            <div key={k} className="rounded-card border border-white/10 bg-white/5 p-6 backdrop-blur">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-accent">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-xs font-bold text-accent">0{i + 1}</p>
              <h3 className="mt-1 font-display font-bold text-white">{t(`home.${k}`)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-primary-100">{t(`home.${k}t`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
