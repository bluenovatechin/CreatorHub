import { useTranslation } from 'react-i18next';
import { Handshake } from 'lucide-react';
import { EmptyState } from '@bluenova/ui';
import type { DealView } from '../../../lib/types';
import { DealList } from '../components/CreatorCommon';

export function CreatorRecentDeals({ deals }: { deals: DealView[] }) {
  const { t } = useTranslation();

  return (
    <section>
      <h2 className="mb-4 font-display text-xl font-bold text-navy">{t('creatorHome.dealsTitle')}</h2>
      {deals.length === 0 ? <EmptyState icon={<Handshake />} title={t('creatorHome.noDeals')} /> : <DealList deals={deals} />}
    </section>
  );
}
