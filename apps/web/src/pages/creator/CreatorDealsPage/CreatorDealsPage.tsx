/**
 * CREATOR DEALS PAGE (/creator/deals)
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Handshake } from 'lucide-react';
import { EmptyState, PageHeader } from '@bluenova/ui';
import { api } from '../../../lib/api';
import type { DealView } from '../../../lib/types';
import { QueryState } from '../../../components/common';
import { DealList } from '../components/CreatorCommon';
import './CreatorDealsPage.css';

export function CreatorDealsPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['deals'], queryFn: () => api.get<DealView[]>('/deals') });

  return (
    <div className="creator-deals-page">
      <PageHeader title={t('deals.title')} subtitle={t('deals.subtitle')} />
      {q.isLoading || q.error ? (
        <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState icon={<Handshake />} title={t('deals.none')} />
      ) : (
        <DealList deals={q.data!} />
      )}
    </div>
  );
}
