/**
 * BRAND DASHBOARD (/brand)
 * Modularized dashboard using dedicated subcomponents.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import type { DealView } from '../../../lib/types';
import { useAppConfig } from '../../../lib/config';
import { SafetyTip } from '../../../components/common';
import { useCampaigns } from '../components/BrandCommon';
import { BrandDashboardHero } from './BrandDashboardHero';
import { BrandStats } from './BrandStats';
import { BrandActionRequired } from './BrandActionRequired';
import { BrandRecentCampaigns } from './BrandRecentCampaigns';
import './BrandDashboard.css';

export function BrandDashboard() {
  const { me } = useAuth();
  const { paymentsEnabled } = useAppConfig();
  const q = useCampaigns();
  const deals = useQuery({ queryKey: ['deals'], queryFn: () => api.get<DealView[]>('/deals') });
  const list = q.data ?? [];
  const working = (deals.data ?? []).filter((d) =>
    ['IN_PRODUCTION', 'DRAFT_SUBMITTED', 'BRAND_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'LIVE_SUBMITTED'].includes(d.status),
  ).length;

  return (
    <div className="brand-dashboard space-y-8">
      <BrandDashboardHero companyName={me?.brand?.companyName ?? undefined} />
      <BrandStats campaigns={list} workingCreatorsCount={working} paymentsEnabled={paymentsEnabled} />
      <BrandActionRequired campaigns={list} paymentsEnabled={paymentsEnabled} />
      <BrandRecentCampaigns
        campaigns={list}
        isLoading={q.isLoading}
        error={q.error}
        retry={() => q.refetch()}
      />
      <SafetyTip />
    </div>
  );
}
