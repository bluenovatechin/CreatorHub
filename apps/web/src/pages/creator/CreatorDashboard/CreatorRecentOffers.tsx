import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { EmptyState } from '@bluenova/ui';
import type { OfferView } from '../../../lib/types';
import { OfferCard } from '../components/CreatorCommon';

export function CreatorRecentOffers({ offers }: { offers: OfferView[] }) {
  const { t } = useTranslation();

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-navy">{t('creatorHome.offersTitle')}</h2>
        <Link to="/creator/offers" className="text-sm font-semibold text-primary hover:underline">
          {t('common.seeAll')}
        </Link>
      </div>
      {offers.length === 0 ? (
        <EmptyState icon={<Mail />} title={t('creatorHome.noOffers')} text={t('creatorHome.noOffersText')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {offers.map((o) => (
            <OfferCard key={o.id} o={o} />
          ))}
        </div>
      )}
    </section>
  );
}
