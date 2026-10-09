/**
 * ADMIN WORK SCREENS: dashboard (work queues), creators (review: claim → decide), campaigns
 * (claim → shortlist creators → send to brand → start), audit log.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  CAMPAIGN_STATUSES, CATEGORIES, CITIES, CREATOR_STATUSES, REVIEW_REASON_CODES, catalogLabel,
} from '@bluenova/shared';
import { Alert, Badge, Button, Card, EmptyState, ExternalLink, Field, Input, Loading, PageHeader, Select, StatCard, Textarea } from '@bluenova/ui';
import { CheckCircle2, ClipboardList, Clock, Mail, Megaphone, UserCheck, Users, Wallet } from 'lucide-react';
import { api, can, date, errorText, label, rupees, tone, useAdmin, useFeatures } from '../lib';

const cat = (k: string) => catalogLabel(CATEGORIES, k, 'en');
const city = (k: string | null) => (k ? catalogLabel(CITIES, k, 'en') : '—');

/** Wraps a button action: shows its error, and refreshes the listed queries when it succeeds. */
export function useAction<T = unknown>(fn: () => Promise<T>, invalidate: unknown[][]) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: fn,
    onMutate: () => setError(null),
    onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })),
    onError: (e) => setError(errorText(e)),
  });
  return { ...m, error };
}

/** Coloured status pill (e.g. SUBMITTED, APPROVED). */
export function Status({ s }: { s: string }) {
  return <Badge tone={tone(s)}>{label(s)}</Badge>;
}

/** Loading spinner or error-with-retry for a query. Renders nothing once data is ready. */
export function QState({ q }: { q: { isLoading: boolean; error: unknown; refetch: () => unknown } }) {
  if (q.isLoading) return <Loading />;
  if (q.error) return <Alert tone="red" title={errorText(q.error)}><Button size="sm" variant="secondary" className="mt-2" onClick={() => q.refetch()}>Retry</Button></Alert>;
  return null;
}

/* ---------- dashboard ---------- */

export function DashboardPage() {
  const { me } = useAdmin();
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Record<string, number> & { paymentsEnabled?: boolean }>('/admin/dashboard') });
  const tiles: { key: string; label: string; to?: string; icon: JSX.Element; tone: 'blue' | 'teal' | 'amber' | 'green' }[] = [
    { key: 'pendingCreators', label: 'Creators waiting for review', to: '/creators?status=SUBMITTED', icon: <Users />, tone: 'amber' },
    { key: 'underReview', label: 'Creators under review', to: '/creators?status=UNDER_REVIEW', icon: <UserCheck />, tone: 'blue' },
    { key: 'campaignsToReview', label: 'New campaigns to claim', to: '/campaigns?status=SUBMITTED', icon: <Megaphone />, tone: 'amber' },
    { key: 'campaignsInReview', label: 'Campaigns needing a shortlist', to: '/campaigns?status=IN_REVIEW', icon: <ClipboardList />, tone: 'blue' },
    ...(q.data?.paymentsEnabled ? [{ key: 'paymentsToVerify', label: 'Payments to verify', to: '/payments?status=SUBMITTED', icon: <Wallet />, tone: 'amber' as const }] : []),
    { key: 'offersSent', label: 'Offers awaiting creators', icon: <Mail />, tone: 'blue' },
    { key: 'awaitingPayment', label: q.data?.paymentsEnabled ? 'Deals awaiting payment' : 'Accepted deals waiting to start', to: '/campaigns?status=PAYMENT_PENDING', icon: <Clock />, tone: 'teal' },
    { key: 'approvedCreators', label: 'Approved creators', to: '/creators?status=APPROVED', icon: <CheckCircle2 />, tone: 'green' },
  ];
  return (
    <div>
      <PageHeader title={`Hello, ${me?.name ?? 'team'}`} subtitle="Work queues" />
      {q.isLoading || q.error ? <QState q={q} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => {
            const body = <StatCard icon={t.icon} tone={t.tone} label={t.label} value={q.data?.[t.key] ?? 0} />;
            return t.to ? <Link key={t.key} to={t.to} className="block transition hover:-translate-y-0.5">{body}</Link> : <div key={t.key}>{body}</div>;
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- creators ---------- */

interface AdminCreator {
  id: string; displayName: string | null; fullName: string | null; igHandle: string | null; city: string | null; categories: string[]; languages: string[];
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

export function CreatorDetailPage() {
  const { id } = useParams();
  const { me } = useAdmin();
  const q = useQuery({ queryKey: ['creator', id], queryFn: () => api.get<AdminCreator & { deals: { id: string; type: string; status: string }[] }>(`/admin/creators/${id}`) });
  const [decision, setDecision] = useState<'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED'>('APPROVED');
  const [scores, setScores] = useState({ quality: 4, consistency: 4, audienceFit: 4, engagement: 4 });
  const [reasonCode, setReasonCode] = useState<string>('INCOMPLETE_PROFILE');
  const [reasonText, setReasonText] = useState('');
  const claim = useAction(() => api.post(`/admin/creators/${id}/claim`), [['creator', id], ['creators'], ['dashboard']]);
  const decide = useAction(() => api.post(`/admin/creators/${id}/decision`, {
    decision,
    scores: decision === 'CHANGES_REQUESTED' ? undefined : scores,
    reasonCode: decision === 'APPROVED' ? undefined : reasonCode,
    reasonText: decision === 'APPROVED' ? (reasonText || undefined) : reasonText,
  }), [['creator', id], ['creators'], ['dashboard']]);

  if (q.isLoading || q.error) return <QState q={q} />;
  const c = q.data!;
  const reviewer = can(me, 'reviewer');
  return (
    <div className="space-y-4">
      <Link to="/creators" className="text-sm font-semibold text-primary">← Creators</Link>
      <PageHeader title={c.displayName ?? 'Creator'} subtitle={`${c.fullName ?? ''} · ${c.phone ?? ''}`} action={<Status s={c.status} />} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-ink-muted">Instagram</dt><dd>{c.igHandle ? <ExternalLink href={`https://www.instagram.com/${c.igHandle}/`}>@{c.igHandle}</ExternalLink> : '—'}</dd></div>
            <div><dt className="text-ink-muted">City</dt><dd>{city(c.city)}</dd></div>
            <div><dt className="text-ink-muted">Categories</dt><dd>{c.categories.map(cat).join(', ')}</dd></div>
            <div><dt className="text-ink-muted">Languages</dt><dd>{c.languages.join(', ')}</dd></div>
            <div><dt className="text-ink-muted">Followers / avg views</dt><dd>{c.stats.followers?.toLocaleString('en-IN')} / {c.stats.avgViews?.toLocaleString('en-IN')} ({label(c.stats.followerBand)})</dd></div>
            <div><dt className="text-ink-muted">Engagement</dt><dd>{c.stats.engagementRate}%</dd></div>
            <div><dt className="text-ink-muted">Rate card</dt><dd>{Object.entries(c.rateCardPaise).map(([k, v]) => `${label(k)} ${rupees(v)}`).join(' · ') || '—'}{c.acceptsBarter ? ' · accepts barter' : ''}</dd></div>
            <div><dt className="text-ink-muted">Gender / age</dt><dd>{label(c.gender)} / {c.ageGroup ?? '—'}</dd></div>
          </dl>
          {c.bio && <p className="mt-4 text-sm">{c.bio}</p>}
          <h2 className="mt-5 font-semibold">Reels</h2>
          <ul className="mt-1 space-y-1 text-sm">{c.reels.map((r) => <li key={r}><ExternalLink href={r}>{r}</ExternalLink></li>)}</ul>
        </Card>
        <Card>
          <h2 className="font-semibold">Review</h2>
          {c.status === 'SUBMITTED' && reviewer && (
            <>
              <p className="mt-1 text-sm text-ink-muted">Claim this application to start the review.</p>
              <Button className="mt-3" loading={claim.isPending} onClick={() => claim.mutate()}>Claim for review</Button>
            </>
          )}
          {c.status === 'UNDER_REVIEW' && reviewer && (
            <div className="mt-3 space-y-4">
              <Field label="Decision">
                {(fid) => (
                  <Select id={fid} value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
                    <option value="APPROVED">Approve</option>
                    <option value="CHANGES_REQUESTED">Request changes</option>
                    <option value="REJECTED">Reject</option>
                  </Select>
                )}
              </Field>
              {decision !== 'CHANGES_REQUESTED' && (
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(scores) as (keyof typeof scores)[]).map((k) => (
                    <Field key={k} label={label(k.replace(/([A-Z])/g, '_$1'))}>
                      {(fid) => (
                        <Select id={fid} value={scores[k]} onChange={(e) => setScores((s) => ({ ...s, [k]: Number(e.target.value) }))}>
                          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                        </Select>
                      )}
                    </Field>
                  ))}
                </div>
              )}
              {decision !== 'APPROVED' && (
                <Field label="Reason">
                  {(fid) => (
                    <Select id={fid} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
                      {REVIEW_REASON_CODES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
                    </Select>
                  )}
                </Field>
              )}
              <Field label={decision === 'APPROVED' ? 'Note (optional)' : 'Message to the creator (they will see this)'}>
                {(fid) => <Textarea id={fid} maxLength={1000} value={reasonText} onChange={(e) => setReasonText(e.target.value)} />}
              </Field>
              {decide.error && <Alert tone="red">{decide.error}</Alert>}
              <Button block variant={decision === 'REJECTED' ? 'danger' : 'primary'} loading={decide.isPending}
                disabled={decision !== 'APPROVED' && reasonText.trim().length < 3} onClick={() => decide.mutate()}>
                Submit decision
              </Button>
            </div>
          )}
          {claim.error && <Alert tone="red">{claim.error}</Alert>}
          {c.review?.scores && <p className="mt-3 text-sm">Scores: {Object.entries(c.review.scores).map(([k, v]) => `${k} ${v}`).join(' · ')}</p>}
          {c.review?.reasonText && <p className="mt-2 text-sm">Last message: {c.review.reasonText}</p>}
          <h3 className="mt-5 text-sm font-semibold">History</h3>
          <ul className="mt-1 space-y-1 text-xs text-ink-muted">
            {c.statusHistory.map((h, i) => <li key={i}>{date(h.at)} — {label(h.from)} → {label(h.to)}{h.reason ? ` (${h.reason})` : ''}</li>)}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ---------- campaigns ---------- */

interface AdminCampaign {
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

interface Match { creator: AdminCreator; score: { total: number; category: number; city: number; language: number; followerBand: number; budget: number; creatorScore: number } }

export function CampaignDetailPage() {
  const { id } = useParams();
  const { me } = useAdmin();
  const q = useQuery({ queryKey: ['campaign', id], queryFn: () => api.get<AdminCampaign>(`/admin/campaigns/${id}`) });
  const c = q.data;
  const shortlistOpen = !!c && ['IN_REVIEW', 'SHORTLIST_SENT', 'CREATORS_SELECTED', 'PAYMENT_PENDING'].includes(c.status);
  const matches = useQuery({ queryKey: ['matches', id], queryFn: () => api.get<Match[]>(`/admin/campaigns/${id}/matches`), enabled: shortlistOpen });
  const [payout, setPayout] = useState<Record<string, string>>({});
  const [price, setPrice] = useState<Record<string, string>>({});
  const inv = [['campaign', id], ['matches', id], ['campaigns'], ['dashboard']];
  const claim = useAction(() => api.post(`/admin/campaigns/${id}/claim`), inv);
  const start = useAction(() => api.post(`/admin/campaigns/${id}/start`), inv);
  const { paymentsEnabled } = useFeatures();
  const send = useAction(() => api.post(`/admin/campaigns/${id}/shortlist/send`), inv);
  const [addError, setAddError] = useState<string | null>(null);
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: (v: { creatorId: string; payout: string }) => api.post(`/admin/campaigns/${id}/shortlist`, {
      items: [{ creatorId: v.creatorId, creatorPayout: Number(v.payout), brandPrice: price[v.creatorId] ? Number(price[v.creatorId]) : undefined }],
    }),
    onMutate: () => setAddError(null),
    onSuccess: () => inv.forEach((k) => qc.invalidateQueries({ queryKey: k })),
    onError: (e) => setAddError(errorText(e)),
  });
  const withdraw = useMutation({
    mutationFn: (itemId: string) => api.post(`/admin/shortlist-items/${itemId}/withdraw`),
    onSuccess: () => inv.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  });

  if (q.isLoading || q.error) return <QState q={q} />;
  const proposed = (c!.shortlist ?? []).filter((s) => s.status === 'PROPOSED').length;

  return (
    <div className="space-y-4">
      <Link to="/campaigns" className="text-sm font-semibold text-primary">← Campaigns</Link>
      <PageHeader title={c!.title} subtitle={c!.brand?.companyName} action={<Status s={c!.status} />} />
      {claim.error && <Alert tone="red">{claim.error}</Alert>}
      {send.error && <Alert tone="red">{send.error}</Alert>}
      {start.error && <Alert tone="red">{start.error}</Alert>}
      {!paymentsEnabled && (c!.deals ?? []).some((d) => d.status === 'AWAITING_PAYMENT') && can(me, 'campaign_manager') && (
        <Card className="border-accent/40 bg-accent-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-navy"><strong>Creators have accepted.</strong> Once you have confirmed the campaign with the brand (outside the website), start it — creators are notified to begin.</p>
            <Button variant="accent" loading={start.isPending} onClick={() => start.mutate()}>Start campaign</Button>
          </div>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <p className="whitespace-pre-line text-sm">{c!.description}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-ink-muted">Goal</dt><dd>{label(c!.goal)}</dd></div>
            <div><dt className="text-ink-muted">Type</dt><dd>{label(c!.collabType)}</dd></div>
            <div><dt className="text-ink-muted">Categories</dt><dd>{c!.filters.categories.map(cat).join(', ')}</dd></div>
            <div><dt className="text-ink-muted">Cities</dt><dd>{c!.filters.cities.map((k) => city(k)).join(', ') || 'Any'}</dd></div>
            <div><dt className="text-ink-muted">Audience size</dt><dd>{c!.filters.followerBands.map(label).join(', ') || 'Any'}</dd></div>
            <div><dt className="text-ink-muted">Deliverables</dt><dd>{c!.deliverables.map((d) => `${d.quantity}× ${label(d.type)}`).join(', ')} · {c!.creatorsNeeded} creators</dd></div>
            <div><dt className="text-ink-muted">Budget</dt><dd>{c!.budget?.suggest ? 'Bluenova to suggest' : `${rupees(c!.budget?.minPaise)} – ${rupees(c!.budget?.maxPaise)}`}</dd></div>
            <div><dt className="text-ink-muted">Dates</dt><dd>{date(c!.startDate)} – {date(c!.endDate)}</dd></div>
            <div><dt className="text-ink-muted">Interested creators</dt><dd>{c!.interestedCount}</dd></div>
          </dl>
        </Card>
        <Card>
          <h2 className="font-semibold">Brand</h2>
          <p className="mt-2 text-sm">{c!.brand?.companyName}<br />{c!.brand?.contactName}<br />{c!.brand?.email}<br />{c!.brand?.phone}<br />GSTIN: {c!.brand?.gstin ?? '—'}</p>
          {c!.status === 'SUBMITTED' && <Button className="mt-4" block loading={claim.isPending} onClick={() => claim.mutate()}>Claim campaign</Button>}
          {shortlistOpen && proposed > 0 && (
            <Button className="mt-4" block variant="accent" loading={send.isPending} onClick={() => send.mutate()}>Send shortlist to brand ({proposed})</Button>
          )}
        </Card>
      </div>

      {(c!.shortlist ?? []).length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Shortlist</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-ink-muted"><tr><th className="p-2">Creator</th><th className="p-2">Payout</th><th className="p-2">Brand price</th><th className="p-2">Margin</th><th className="p-2">Status</th><th className="p-2" /></tr></thead>
              <tbody className="divide-y divide-line">
                {c!.shortlist!.map((s) => (
                  <tr key={s.id}>
                    <td className="p-2"><Link to={`/creators/${s.creatorId}`} className="text-primary">{s.creator?.displayName ?? s.creatorId}</Link></td>
                    <td className="p-2">{rupees(s.creatorPayoutPaise)}</td>
                    <td className="p-2">{rupees(s.brandPricePaise)}</td>
                    <td className="p-2">{rupees(s.marginPaise)}</td>
                    <td className="p-2"><Status s={s.status} /></td>
                    <td className="p-2">{s.status === 'PROPOSED' && <Button size="sm" variant="ghost" loading={withdraw.isPending && withdraw.variables === s.id} onClick={() => withdraw.mutate(s.id)}>Withdraw</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {(c!.offers ?? []).length > 0 && (
        <Card>
          <h2 className="mb-3 font-semibold">Offers & deals</h2>
          <ul className="space-y-1 text-sm">
            {c!.offers!.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2">
                <Status s={o.status} /> {rupees(o.payoutPaise)} · expires {date(o.expiresAt)}
                {o.decline && <span className="text-ink-muted">— declined: {label(o.decline.reason)} {o.decline.note}</span>}
              </li>
            ))}
            {(c!.deals ?? []).map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">Deal <Status s={d.status} /> price {rupees(d.brandPricePaise)} · payout {rupees(d.creatorPayoutPaise)} · margin {rupees(d.marginPaise)}</li>
            ))}
          </ul>
        </Card>
      )}

      {shortlistOpen && (
        <Card>
          <h2 className="font-semibold">Matching creators</h2>
          <p className="mb-3 text-sm text-ink-muted">Ranked by match score. Enter the creator payout; the brand price defaults to the standard margin unless you set it.</p>
          {addError && <div className="mb-3"><Alert tone="red">{addError}</Alert></div>}
          {matches.isLoading || matches.error ? <QState q={matches} /> : matches.data!.length === 0 ? <p className="text-sm text-ink-muted">No more matching approved creators.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-ink-muted"><tr><th className="p-2">Score</th><th className="p-2">Creator</th><th className="p-2">City</th><th className="p-2">Followers</th><th className="p-2">Reel rate</th><th className="p-2">Payout ₹</th><th className="p-2">Brand price ₹</th><th className="p-2" /></tr></thead>
                <tbody className="divide-y divide-line">
                  {matches.data!.map(({ creator: m, score }) => {
                    const payoutValue = payout[m.id] ?? (m.rateCardPaise.REEL ? String(m.rateCardPaise.REEL / 100) : '');
                    return (
                    <tr key={m.id}>
                      <td className="p-2 font-bold" title={`category ${score.category} · city ${score.city} · language ${score.language} · band ${score.followerBand} · budget ${score.budget} · score ${score.creatorScore}`}>{score.total}</td>
                      <td className="p-2"><Link to={`/creators/${m.id}`} className="text-primary">{m.displayName}</Link><div className="text-xs text-ink-muted">{m.categories.map(cat).join(', ')}</div></td>
                      <td className="p-2">{city(m.city)}</td>
                      <td className="p-2">{m.stats.followers?.toLocaleString('en-IN')}</td>
                      <td className="p-2">{rupees(m.rateCardPaise.REEL)}</td>
                      <td className="p-2"><Input aria-label="Payout" inputMode="numeric" className="w-28" value={payoutValue} onChange={(e) => setPayout((p) => ({ ...p, [m.id]: e.target.value.replace(/\D/g, '') }))} /></td>
                      <td className="p-2"><Input aria-label="Brand price" inputMode="numeric" placeholder="auto" className="w-28" value={price[m.id] ?? ''} onChange={(e) => setPrice((p) => ({ ...p, [m.id]: e.target.value.replace(/\D/g, '') }))} /></td>
                      <td className="p-2">
                        <Button size="sm" disabled={!payoutValue} loading={add.isPending && add.variables?.creatorId === m.id}
                          onClick={() => add.mutate({ creatorId: m.id, payout: payoutValue })}>
                          Add
                        </Button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* ---------- audit log ---------- */

export function AuditLogPage() {
  const q = useQuery({
    queryKey: ['audit'],
    queryFn: () => api.get<{ id: string; actorName: string | null; adminRole: string | null; action: string; entityType: string; entityId: string | null; reason: string | null; ip: string | null; createdAt: string }[]>('/admin/audit-logs?limit=50'),
  });
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Read-only record of every admin action." />
      {q.isLoading || q.error ? <QState q={q} /> : (
        <div className="overflow-x-auto rounded-card border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg text-xs uppercase text-ink-muted"><tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Reason</th><th className="p-3">IP</th></tr></thead>
            <tbody className="divide-y divide-line">
              {q.data!.map((a) => (
                <tr key={a.id}>
                  <td className="p-3 text-xs">{date(a.createdAt)}</td>
                  <td className="p-3">{a.actorName ?? '—'}<div className="text-xs text-ink-muted">{a.adminRole}</div></td>
                  <td className="p-3 font-mono text-xs">{a.action}</td>
                  <td className="p-3 text-xs">{a.entityType} {a.entityId?.slice(-6)}</td>
                  <td className="p-3 text-xs">{a.reason ?? ''}</td>
                  <td className="p-3 text-xs">{a.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
