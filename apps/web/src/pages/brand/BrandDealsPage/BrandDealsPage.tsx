/**
 * BRAND DEALS PAGE (/brand/deals): every creator collaboration; each row opens /brand/deals/:id.
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Handshake } from 'lucide-react';
import { Avatar, EmptyState, PageHeader } from '@bluenova/ui';
import { api } from '../../../lib/api';
import { formatINR } from '../../../lib/format';
import type { DealView } from '../../../lib/types';
import { QueryState, StatusBadge } from '../../../components/common';
import './BrandDealsPage.css';

export function BrandDealsPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['deals'], queryFn: () => api.get<DealView[]>('/deals') });

  return (
    <div className="brand-deals-page">
      <PageHeader title={t('deals.title')} subtitle={t('deals.subtitle')} />
      {q.isLoading || q.error ? (
        <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState icon={<Handshake />} title={t('deals.none')} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">
          {q.data!.map((d) => (
            <li key={d.id}>
              <Link to={`/brand/deals/${d.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-primary-50">
              <div className="flex items-center gap-3">
                <Avatar name={d.creator?.displayName} size="sm" />
                <div>
                  <p className="font-semibold text-navy">{d.creator?.displayName}</p>
                  <p className="text-sm text-ink-muted">{d.campaignTitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {d.brandPricePaise != null && <span className="font-semibold">{formatINR(d.brandPricePaise)}</span>}
                <StatusBadge kind="deal" status={d.status} />
              </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
