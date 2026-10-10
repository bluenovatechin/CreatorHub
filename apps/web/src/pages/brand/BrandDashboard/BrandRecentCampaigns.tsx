import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Megaphone, Plus } from 'lucide-react';
import { EmptyState } from '@bluenova/ui';
import type { CampaignView } from '../../../lib/types';
import { QueryState } from '../../../components/common';
import { primaryLink, CampaignRow } from '../components/BrandCommon';

export function BrandRecentCampaigns({
  campaigns,
  isLoading,
  error,
  retry,
}: {
  campaigns: CampaignView[];
  isLoading: boolean;
  error: unknown;
  retry: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-navy">{t('brandHome.campaignsTitle')}</h2>
        <Link to="/brand/campaigns" className="text-sm font-semibold text-primary hover:underline">
          {t('common.seeAll')}
        </Link>
      </div>
      {isLoading || error ? (
        <QueryState isLoading={isLoading} error={error} retry={retry} />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone />}
          title={t('brandHome.noCampaigns')}
          text={t('brandHome.noCampaignsText')}
          action={
            <Link to="/brand/campaigns/new" className={primaryLink}>
              <Plus className="h-4 w-4" />
              {t('brandHome.newCampaign')}
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">
          {campaigns.slice(0, 5).map((c) => (
            <CampaignRow key={c.id} c={c} />
          ))}
        </ul>
      )}
    </section>
  );
}
