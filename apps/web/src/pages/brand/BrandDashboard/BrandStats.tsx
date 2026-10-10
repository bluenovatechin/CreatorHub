import { useTranslation } from 'react-i18next';
import { Clock, Megaphone, Users, Wallet } from 'lucide-react';
import { StatCard } from '@bluenova/ui';
import type { CampaignView } from '../../../lib/types';

export function BrandStats({
  campaigns,
  workingCreatorsCount,
  paymentsEnabled,
}: {
  campaigns: CampaignView[];
  workingCreatorsCount: number;
  paymentsEnabled: boolean;
}) {
  const { t } = useTranslation();
  const payDue = campaigns.filter((c) => c.status === 'PAYMENT_PENDING');

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        icon={<Megaphone />}
        label={t('brandHome.statActive')}
        value={campaigns.filter((c) => c.status === 'ACTIVE').length}
        tone="teal"
      />
      <StatCard
        icon={<Clock />}
        label={t('brandHome.statWaiting')}
        value={campaigns.filter((c) => ['SUBMITTED', 'IN_REVIEW'].includes(c.status)).length}
      />
      <StatCard
        icon={<Wallet />}
        label={paymentsEnabled ? t('brandHome.statPay') : t('brandHome.statStarting')}
        value={payDue.length}
        tone="amber"
      />
      <StatCard
        icon={<Users />}
        label={t('brandHome.statCreators')}
        value={workingCreatorsCount}
        tone="green"
      />
    </div>
  );
}
