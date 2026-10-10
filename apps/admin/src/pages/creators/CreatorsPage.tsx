import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { CATEGORIES, CITIES, CREATOR_STATUSES, catalogLabel } from '@bluenova/shared';
import { EmptyState, Input, PageHeader, Select } from '@bluenova/ui';
import { api, date, label } from '../../lib';
import { QState, Status } from '../../components/common';

const cat = (k: string) => catalogLabel(CATEGORIES, k, 'en');
const city = (k: string | null) => (k ? catalogLabel(CITIES, k, 'en') : '—');

export interface AdminCreator {
  id: string; displayName: string | null; fullName: string | null; igHandle: string | null; city: string | null; areas?: string[]; categories: string[]; languages: string[];
  reels: string[]; status: string; phone: string | null; bio: string | null; gender: string | null; ageGroup: string | null;
  stats: { followers: number | null; avgViews: number | null; engagementRate: number | null; followerBand: string | null };
  rateCardPaise: Record<string, number>; acceptsBarter: boolean; creatorScore: number; submittedAt: string | null; createdAt: string;
  review: { scores: Record<string, number> | null; reasonCode: string | null; reasonText: string | null; claimedBy: string | null } | null;
  statusHistory: { from: string | null; to: string | null; at: string | null; reason?: string | null }[];
}

export function CreatorsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'SUBMITTED';
  const [q, setQ] = useState('');
  const query = useQuery({
    queryKey: ['creators', status, q],
    queryFn: () => api.get<AdminCreator[]>(`/admin/creators?limit=50${status !== 'ALL' ? `&status=${status}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  });

  return (
    <div>
      <PageHeader title="Creators" />
      <div className="mb-4 flex flex-wrap gap-3">
        <Select aria-label="Status" className="max-w-56" value={status} onChange={(e) => setParams({ status: e.target.value })}>
          <option value="ALL">All statuses</option>
          {CREATOR_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </Select>
        <Input aria-label="Search" placeholder="Search name or handle" className="max-w-64" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {query.isLoading || query.error ? <QState q={query} /> : query.data!.length === 0 ? <EmptyState title="No creators here" /> : (
        <div className="overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg text-xs uppercase text-ink-muted">
              <tr><th className="p-3">Creator</th><th className="p-3">City</th><th className="p-3">Categories</th><th className="p-3">Followers</th><th className="p-3">Status</th><th className="p-3">Submitted</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {query.data!.map((c) => (
                <tr key={c.id} className="hover:bg-bg">
                  <td className="p-3"><Link className="font-semibold text-primary" to={`/creators/${c.id}`}>{c.displayName ?? '—'}</Link><div className="text-xs text-ink-muted">@{c.igHandle}</div></td>
                  <td className="p-3">{city(c.city)}</td>
                  <td className="p-3">{c.categories.map(cat).join(', ')}</td>
                  <td className="p-3">{c.stats.followers?.toLocaleString('en-IN') ?? '—'}</td>
                  <td className="p-3"><Status s={c.status} /></td>
                  <td className="p-3">{date(c.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
