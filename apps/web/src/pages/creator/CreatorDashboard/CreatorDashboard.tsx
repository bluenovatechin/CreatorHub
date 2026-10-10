/**
 * CREATOR DASHBOARD (/creator)
 * Modularized dashboard using dedicated subcomponents.
 */
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import type { DealView, OfferView } from '../../../lib/types';
import { QueryState } from '../../../components/common';
import { useProfile } from '../components/CreatorCommon';
import { CreatorDashboardHero } from './CreatorDashboardHero';
import { CreatorStats } from './CreatorStats';
import { CreatorIntroBanner } from './CreatorIntroBanner';
import { CreatorRecentOffers } from './CreatorRecentOffers';
import { CreatorRecentDeals } from './CreatorRecentDeals';
import { CompletenessMeter, profileChecklist } from '../CreatorProfilePage/CreatorProfilePage';
import './CreatorDashboard.css';

export function CreatorDashboard() {
  const profile = useProfile();
  const offers = useQuery({ queryKey: ['offers'], queryFn: () => api.get<OfferView[]>('/offers') });
  const deals = useQuery({ queryKey: ['deals'], queryFn: () => api.get<DealView[]>('/deals') });

  if (profile.isLoading || profile.error) return <QueryState isLoading={profile.isLoading} error={profile.error} retry={() => profile.refetch()} />;
  const p = profile.data!;
  if (p.status !== 'APPROVED') return <Navigate to="/creator/status" replace />;
  const intro = deals.data?.find((d) => d.type === 'INTRO_REEL');
  const openOffers = (offers.data ?? []).filter((o) => o.status === 'SENT');
  const brandDeals = (deals.data ?? []).filter((d) => d.type === 'BRAND');
  const active = brandDeals.filter((d) => !['COMPLETED', 'CANCELLED'].includes(d.status)).length;
  const done = brandDeals.filter((d) => d.status === 'COMPLETED').length;

  return (
    <div className="creator-dashboard space-y-8">
      <CreatorDashboardHero displayName={p.displayName ?? undefined} />
      <CreatorStats
        openOffersCount={openOffers.length}
        activeDealsCount={active}
        doneDealsCount={done}
        creatorScore={p.creatorScore}
      />
      <CreatorIntroBanner intro={intro} />
      {profileChecklist(p).some((i) => !i.done) && (
        <Link to="/creator/profile" className="block rounded-card border border-line bg-white p-5 shadow-card transition hover:border-primary-200">
          <CompletenessMeter p={p} compact />
        </Link>
      )}
      <CreatorRecentOffers offers={openOffers} />
      <CreatorRecentDeals deals={brandDeals} />
    </div>
  );
}
