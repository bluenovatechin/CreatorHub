import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { catalogLabel, CITIES } from '@bluenova/shared';
import { Badge, Button, EmptyState, Input, PageHeader, cx } from '@bluenova/ui';
import { Search } from 'lucide-react';
import { api, date, label } from '../../lib';
import { QState, Status } from '../../components/common';

const city = (k: string | null | undefined) => (k ? catalogLabel(CITIES, k, 'en') : '—');

export interface Account {
  id: string; name: string | null; email: string; role: 'creator' | 'brand' | 'admin' | null; adminRole: string | null;
  status: string; emailVerified: boolean; signIn: { password: boolean; google: boolean }; preferredLanguage: string | null;
  createdAt: string | null; lastLoginAt: string | null; passwordChangedAt: string | null;
}
export interface UserRow extends Account {
  profile: { kind: 'creator' | 'brand'; id: string; title: string | null; igHandle: string | null; city: string | null; status: string; phone: string | null } | null;
}
export type Counts = { all: number; creator: number; brand: number; none: number; admin: number };

export const TABS = [
  { key: 'all', label: 'All' },
  { key: 'creator', label: 'Creators' },
  { key: 'brand', label: 'Brands' },
  { key: 'none', label: 'No role yet' },
  { key: 'admin', label: 'Team' },
] as const;

export function RoleBadge({ u }: { u: Account }) {
  if (u.role === 'admin') return <Badge tone="teal">Team · {label(u.adminRole)}</Badge>;
  if (u.role === 'creator') return <Badge tone="blue">Creator</Badge>;
  if (u.role === 'brand') return <Badge tone="amber">Brand</Badge>;
  return <Badge tone="grey">No role yet</Badge>;
}

export function SignInMethods({ s }: { s: Account['signIn'] }) {
  return <span className="text-xs text-ink-muted">{[s.password && 'Email + password', s.google && 'Google'].filter(Boolean).join(' · ') || '—'}</span>;
}

export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('role') ?? 'all') as (typeof TABS)[number]['key'];
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  const query = useQuery({
    queryKey: ['users', tab, q],
    queryFn: () => api.getWithMeta<UserRow[]>(`/admin/users?limit=100${tab !== 'all' ? `&role=${tab}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  });
  const counts = query.data?.meta?.counts as Counts | undefined;
  const rows = query.data?.data ?? [];

  return (
    <div>
      <PageHeader title="Users" subtitle="Every account on the website: creators, brands, people who haven't chosen yet, and the team." />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
            onClick={() => setParams(t.key === 'all' ? {} : { role: t.key })}
            className={cx('rounded-full px-3 py-1.5 text-sm font-semibold', tab === t.key ? 'bg-primary text-white' : 'bg-white text-ink-muted ring-1 ring-line hover:bg-bg')}>
            {t.label}{counts ? ` (${counts[t.key]})` : ''}
          </button>
        ))}
      </div>
      <form className="mb-4 flex max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); setQ(search.trim()); }}>
        <Input aria-label="Search" placeholder="Search name or email" icon={<Search />} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      {query.isLoading || query.error ? <QState q={query} /> : rows.length === 0 ? <EmptyState title="No users here" /> : (
        <div className="overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg text-xs uppercase text-ink-muted">
              <tr><th className="p-3">Person</th><th className="p-3">Type</th><th className="p-3">Profile</th><th className="p-3">Phone</th><th className="p-3">Account</th><th className="p-3">Joined</th><th className="p-3">Last login</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-bg">
                  <td className="p-3">
                    <Link className="font-semibold text-primary" to={`/users/${u.id}`}>{u.name ?? '—'}</Link>
                    <div className="text-xs text-ink-muted">{u.email}</div>
                    <SignInMethods s={u.signIn} />
                  </td>
                  <td className="p-3"><RoleBadge u={u} /></td>
                  <td className="p-3">
                    {u.profile ? (
                      <>
                        <div>{u.profile.title ?? <span className="text-ink-muted">not filled yet</span>}{u.profile.igHandle ? <span className="text-ink-muted"> · @{u.profile.igHandle}</span> : null}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">{city(u.profile.city)} <Status s={u.profile.status} /></div>
                      </>
                    ) : '—'}
                  </td>
                  <td className="p-3">{u.profile?.phone ?? '—'}</td>
                  <td className="p-3">
                    <Badge tone={u.status === 'active' ? 'green' : 'red'}>{label(u.status)}</Badge>
                    {!u.emailVerified && <div className="mt-1 text-xs text-warning">Email not verified</div>}
                  </td>
                  <td className="p-3">{date(u.createdAt)}</td>
                  <td className="p-3">{date(u.lastLoginAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {query.data?.meta?.nextCursor ? <p className="mt-3 text-sm text-ink-muted">Showing the newest 100. Use search to find older accounts.</p> : null}
    </div>
  );
}
