/**
 * CAMPAIGNS PAGE (/brand/campaigns): the brand's campaigns, newest first, 20 at a time ("Load more").
 * API: GET /campaigns?limit=&cursor= (apps/api/src/modules/brands/brands.routes.ts).
 */
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Megaphone, Plus } from 'lucide-react';
import { Button, EmptyState, PageHeader } from '@bluenova/ui';
import { api } from '../../../lib/api';
import type { CampaignView } from '../../../lib/types';
import { QueryState } from '../../../components/common';
import { primaryLink, CampaignRow } from '../components/BrandCommon';
import './CampaignsPage.css';

const PAGE = 20;

export function CampaignsPage() {
  const { t } = useTranslation();
  const q = useInfiniteQuery({
    queryKey: ['campaigns', 'pages'],
    initialPageParam: '',
    queryFn: ({ pageParam }) => api.getWithMeta<CampaignView[]>(`/campaigns?limit=${PAGE}${pageParam ? `&cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => (last.meta?.nextCursor as string | null) ?? undefined,
  });
  const list = q.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div className="campaigns-page">
      <PageHeader
        title={t('nav.campaigns')}
        action={
          <Link to="/brand/campaigns/new" className={primaryLink}>
            <Plus className="h-4 w-4" />
            {t('brandHome.newCampaign')}
          </Link>
        }
      />
      {q.isLoading || q.error ? (
        <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={<Megaphone />} title={t('brandHome.noCampaigns')} text={t('brandHome.noCampaignsText')} />
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">
            {list.map((c) => (
              <CampaignRow key={c.id} c={c} />
            ))}
          </ul>
          {q.hasNextPage && (
            <div className="mt-4 text-center">
              <Button variant="secondary" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>{t('common.loadMore')}</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
