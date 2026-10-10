import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { CAMPAIGN_STATUSES, CATEGORIES, catalogLabel } from '@bluenova/shared';
import { EmptyState, PageHeader, Select } from '@bluenova/ui';
import { api, date, label } from '../../lib';
import { QState, Status } from '../../components/common';

const cat = (k: string) => catalogLabel(CATEGORIES, k, 'en');

export interface AdminCampaign {
  id: string; title: string; goal: string; description: string; status: string; companyName?: string | null;
  filters: { categories: string[]; cities: string[]; languages: string[]; followerBands: string[] };
  deliverables: { type: string; quantity: number }[]; creatorsNeeded: number; collabType: string;
  budget: { suggest?: boolean; minPaise?: number; maxPaise?: number } | null; startDate: string; endDate: string; interestedCount: number;
  brand?: { companyName: string; contactName: string; email: string; phone: string; gstin: string | null; city: string } | null;
  shortlist?: { id: string; status: string; creatorId: string; brandPricePaise: number; creatorPayoutPaise: number; marginPaise: number; adminNote: string | null; creator: { displayName: string; igHandle: string } | null }[];
  offers?: { id: string; status: string; creatorId: string; payoutPaise: number; expiresAt: string; decline: { reason: string; note?: string } | null }[];
  deals?: { id: string; status: string; creatorId: string; brandPricePaise: number; creatorPayoutPaise: number; marginPaise: number }[];
}

export function CampaignsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'ALL';
  const q = useQuery({ queryKey: ['campaigns', status], queryFn: () => api.get<AdminCampaign[]>(`/admin/campaigns?limit=50${status !== 'ALL' ? `&status=${status}` : ''}`) });

  return (
    <div>
      <PageHeader title="Campaigns" />
      <Select aria-label="Status" className="mb-4 max-w-56" value={status} onChange={(e) => setParams({ status: e.target.value })}>
        <option value="ALL">All (except drafts)</option>
        {CAMPAIGN_STATUSES.filter((s) => s !== 'DRAFT').map((s) => <option key={s} value={s}>{label(s)}</option>)}
      </Select>
      {q.isLoading || q.error ? <QState q={q} /> : q.data!.length === 0 ? <EmptyState title="No campaigns here" /> : (
        <div className="overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg text-xs uppercase text-ink-muted"><tr><th className="p-3">Campaign</th><th className="p-3">Brand</th><th className="p-3">Categories</th><th className="p-3">Creators</th><th className="p-3">Dates</th><th className="p-3">Status</th></tr></thead>
            <tbody className="divide-y divide-line">
              {q.data!.map((c) => (
                <tr key={c.id} className="hover:bg-bg">
                  <td className="p-3"><Link to={`/campaigns/${c.id}`} className="font-semibold text-primary">{c.title}</Link></td>
                  <td className="p-3">{c.companyName}</td>
                  <td className="p-3">{c.filters.categories.map(cat).join(', ')}</td>
                  <td className="p-3">{c.creatorsNeeded}</td>
                  <td className="p-3 text-xs">{date(c.startDate)}<br />{date(c.endDate)}</td>
                  <td className="p-3"><Status s={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
