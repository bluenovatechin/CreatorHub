import { useTranslation } from 'react-i18next';
import { CheckCircle2, Handshake, Mail, Star } from 'lucide-react';
import { StatCard } from '@bluenova/ui';

export function CreatorStats({
  openOffersCount,
  activeDealsCount,
  doneDealsCount,
  creatorScore,
}: {
  openOffersCount: number;
  activeDealsCount: number;
  doneDealsCount: number;
  creatorScore?: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard icon={<Mail />} label={t('creatorHome.statOffers')} value={openOffersCount} tone="amber" />
      <StatCard icon={<Handshake />} label={t('creatorHome.statActive')} value={activeDealsCount} tone="teal" />
      <StatCard icon={<CheckCircle2 />} label={t('creatorHome.statDone')} value={doneDealsCount} tone="green" />
      <StatCard icon={<Star />} label={t('creatorHome.statScore')} value={creatorScore} />
    </div>
  );
}
