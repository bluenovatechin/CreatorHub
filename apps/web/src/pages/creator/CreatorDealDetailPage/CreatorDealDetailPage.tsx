/**
 * CREATOR DEAL PAGE (/creator/deals/:id): one collaboration. Campaign, payout and due dates, then the work panel
 * (send the draft link, then the live post link; see every review). Intro reels open /creator/intro-reel instead.
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@bluenova/ui';
import { api } from '../../../lib/api';
import { formatDate, formatINR } from '../../../lib/format';
import type { DealView } from '../../../lib/types';
import { QueryState, StatusBadge } from '../../../components/common';
import { DealWorkPanel } from '../../../components/deals/DealWorkPanel';

export function CreatorDealDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const q = useQuery({ queryKey: ['deals', id], queryFn: () => api.get<DealView>(`/deals/${id}`) });
  if (q.isLoading || q.error) return <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />;
  const d = q.data!;
  if (d.type === 'INTRO_REEL') return <Navigate to="/creator/intro-reel" replace />;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/creator/deals" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ArrowLeft className="h-4 w-4" /> {t('deals.title')}
      </Link>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{d.companyName}</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold text-navy">{d.campaignTitle}</h1>
          </div>
          <StatusBadge kind="deal" status={d.status} />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {d.creatorPayoutPaise != null && (
            <div className="rounded-2xl bg-accent-soft p-4">
              <p className="text-xs font-semibold text-teal-800">{t('deals.payout')}</p>
              <p className="mt-1 font-display text-2xl font-extrabold text-accent">{formatINR(d.creatorPayoutPaise)}</p>
            </div>
          )}
          {d.deadlines && (
            <>
              <div className="rounded-2xl bg-bg p-4">
                <p className="text-xs font-semibold text-ink-muted">{t('offers.draftDue')}</p>
                <p className="mt-1 font-bold text-navy">{formatDate(d.deadlines.draftDue, i18n.language)}</p>
              </div>
              <div className="rounded-2xl bg-bg p-4">
                <p className="text-xs font-semibold text-ink-muted">{t('offers.liveDue')}</p>
                <p className="mt-1 font-bold text-navy">{formatDate(d.deadlines.liveDue, i18n.language)}</p>
              </div>
            </>
          )}
        </div>
      </Card>
      <DealWorkPanel deal={d} viewer="creator" />
    </div>
  );
}
