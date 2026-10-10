import { RatingsCard } from './RatingsCard';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { CATEGORIES, CITIES, REVIEW_REASON_CODES, catalogLabel } from '@bluenova/shared';
import { Alert, Button, Card, ExternalLink, Field, PageHeader, Select, Textarea } from '@bluenova/ui';
import { api, can, date, label, rupees, useAdmin } from '../../lib';
import { QState, Status, useAction } from '../../components/common';
import type { AdminCreator } from './CreatorsPage';

const cat = (k: string) => catalogLabel(CATEGORIES, k, 'en');
const city = (k: string | null) => (k ? catalogLabel(CITIES, k, 'en') : '—');

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
            <div><dt className="text-ink-muted">Areas covered</dt><dd>{(c.areas ?? []).map(city).join(', ') || '—'}</dd></div>
            <div><dt className="text-ink-muted">Categories</dt><dd>{c.categories.map(cat).join(', ')}</dd></div>
            <div><dt className="text-ink-muted">Languages</dt><dd>{c.languages.join(', ')}</dd></div>
            <div><dt className="text-ink-muted">Followers / avg views <span className="text-xs">(self-reported)</span></dt><dd>{c.stats.followers?.toLocaleString('en-IN')} / {c.stats.avgViews?.toLocaleString('en-IN')} ({label(c.stats.followerBand)})</dd></div>
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
      {can(me, 'reviewer', 'campaign_manager') && <RatingsCard targetType="CREATOR" targetId={c.id} />}
    </div>
  );
}
