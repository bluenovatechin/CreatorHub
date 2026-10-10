/**
 * BRAND DEAL PAGE (/brand/deals/:id): one creator's collaboration. Creator card, price, then the work panel:
 * drafts the Bluenova team forwarded (approve or ask for changes) and, at the end, the verified live post.
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Avatar, Card } from '@bluenova/ui';
import { api } from '../../../lib/api';
import { formatINR } from '../../../lib/format';
import type { DealView } from '../../../lib/types';
import { QueryState, StatusBadge } from '../../../components/common';
import { DealWorkPanel } from '../../../components/deals/DealWorkPanel';
import { ReportButton } from '../../../components/ReportButton';

export function BrandDealDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const q = useQuery({ queryKey: ['deals', id], queryFn: () => api.get<DealView>(`/deals/${id}`) });
  if (q.isLoading || q.error) return <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />;
  const d = q.data!;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/brand/deals" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ArrowLeft className="h-4 w-4" /> {t('deals.title')}
      </Link>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={d.creator?.displayName} />
            <div>
              <p className="font-display text-xl font-extrabold text-navy">{d.creator?.displayName}</p>
              <p className="text-sm text-ink-muted">{d.campaignTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {d.brandPricePaise != null && <span className="font-semibold">{formatINR(d.brandPricePaise)}</span>}
            <StatusBadge kind="deal" status={d.status} />
          </div>
        </div>
      </Card>
      <DealWorkPanel deal={d} viewer="brand" />
      {d.creator && <ReportButton targetType="CREATOR" targetId={d.creator.id} />}
    </div>
  );
}
