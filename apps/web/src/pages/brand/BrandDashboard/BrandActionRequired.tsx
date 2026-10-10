import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, Star } from 'lucide-react';
import type { CampaignView } from '../../../lib/types';

export function BrandActionRequired({
  campaigns,
  paymentsEnabled,
}: {
  campaigns: CampaignView[];
  paymentsEnabled: boolean;
}) {
  const { t } = useTranslation();
  const shortlistReady = campaigns.filter((c) => c.status === 'SHORTLIST_SENT');
  const payDue = campaigns.filter((c) => c.status === 'PAYMENT_PENDING');

  return (
    <section>
      <h2 className="mb-4 font-display text-xl font-bold text-navy">{t('brandHome.actionTitle')}</h2>
      {shortlistReady.length + payDue.length === 0 ? (
        <p className="flex items-center gap-2 rounded-card border border-line bg-white px-5 py-4 text-ink-muted">
          <CheckCircle2 className="h-5 w-5 text-success" />
          {t('brandHome.nothing')}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shortlistReady.map((c) => (
            <Link
              key={c.id}
              to={`/brand/campaigns/${c.id}`}
              className="flex items-center justify-between gap-3 rounded-card border border-primary-200 bg-primary-50 p-4 font-semibold text-navy hover:shadow-card"
            >
              <span className="flex items-center gap-3">
                <Star className="h-5 w-5 text-primary" />
                {t('brandHome.shortlistReady', { title: c.title })}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ))}
          {payDue.map((c) => (
            <Link
              key={c.id}
              to={paymentsEnabled ? `/brand/campaigns/${c.id}/payment` : `/brand/campaigns/${c.id}`}
              className="flex items-center justify-between gap-3 rounded-card border border-warning/30 bg-warning-soft p-4 font-semibold text-warning hover:shadow-card"
            >
              <span className="flex items-center gap-3">
                <Clock className="h-5 w-5" />
                {paymentsEnabled ? t('brandHome.paymentDue', { title: c.title }) : t('brandHome.awaitingStart', { title: c.title })}
              </span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
