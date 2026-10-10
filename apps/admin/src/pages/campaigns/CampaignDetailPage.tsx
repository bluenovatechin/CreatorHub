import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { CATEGORIES, CITIES, catalogLabel } from '@bluenova/shared';
import { Alert, Button, Card, Input, PageHeader, useIdempotencyKey } from '@bluenova/ui';
import { api, can, date, errorText, label, rupees, useAdmin, useFeatures } from '../../lib';
import { QState, Status, useAction } from '../../components/common';
import type { AdminCreator } from '../creators';
import type { AdminCampaign } from './CampaignsPage';
import { ApplicationsCard } from './ApplicationsCard';

const cat = (k: string) => catalogLabel(CATEGORIES, k, 'en');
const city = (k: string | null) => (k ? catalogLabel(CITIES, k, 'en') : '—');

interface Match {
  creator: AdminCreator;
  score: { total: number; category: number; city: number; language: number; followerBand: number; budget: number; creatorScore: number };
}

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
  const startKey = useIdempotencyKey(); // a double click starts the campaign only once
  const start = useAction(() => api.post(`/admin/campaigns/${id}/start`, {}, { idempotencyKey: startKey.keyFor() })
    .then((r) => { startKey.renew(); return r; }), inv);
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

      {can(me, 'campaign_manager') && c!.status !== 'DRAFT' && <ApplicationsCard campaignId={id!} shortlistOpen={shortlistOpen} />}

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
