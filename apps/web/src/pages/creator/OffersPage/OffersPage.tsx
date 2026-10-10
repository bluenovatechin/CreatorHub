/**
 * OFFERS PAGE (/creator/offers)
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import { EmptyState, PageHeader } from '@bluenova/ui';
import { api } from '../../../lib/api';
import type { OfferView } from '../../../lib/types';
import { QueryState } from '../../../components/common';
import { OfferCard } from '../components/CreatorCommon';
import './OffersPage.css';

export function OffersPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['offers'], queryFn: () => api.get<OfferView[]>('/offers') });

  return (
    <div className="offers-page">
      <PageHeader title={t('offers.title')} subtitle={t('offers.subtitle')} />
      {q.isLoading || q.error ? (
        <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState icon={<Mail />} title={t('offers.none')} text={t('creatorHome.noOffersText')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {q.data!.map((o) => (
            <OfferCard key={o.id} o={o} />
          ))}
        </div>
      )}
    </div>
  );
}
