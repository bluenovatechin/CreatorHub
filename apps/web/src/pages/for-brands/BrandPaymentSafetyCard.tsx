import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../lib/config';

export function BrandPaymentSafetyCard() {
  const { t } = useTranslation();
  const { paymentsEnabled } = useAppConfig();

  if (!paymentsEnabled) return null;

  return (
    <div className="mt-10 rounded-card border border-line bg-white p-6 shadow-card sm:p-8">
      <h2 className="font-display text-2xl font-extrabold text-navy">{t('home.payTitle')}</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-4">
        {(['pay1', 'pay2', 'pay3', 'pay4'] as const).map((k, i) => (
          <div key={k}>
            <p className="text-xs font-bold text-primary">0{i + 1}</p>
            <p className="mt-1 font-semibold text-navy">{t(`home.${k}`)}</p>
            <p className="mt-1 text-sm text-ink-muted">{t(`home.${k}t`)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
