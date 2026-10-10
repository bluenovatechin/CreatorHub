/**
 * CAMPAIGN DETAIL PAGE (/brand/campaigns/:id)
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Megaphone, Wallet,
} from 'lucide-react';
import {
  Alert, Avatar, Button, Card, CardHeader, Dialog, Field, PageHeader, Tag, Textarea, Timeline, cx, useIdempotencyKey } from '@bluenova/ui';
import { api, errorText } from '../../../lib/api';
import { categoryLabel, cityLabel, formatDate, formatINR } from '../../../lib/format';
import type { CampaignView, CheckoutView, DealView, ShortlistItemView } from '../../../lib/types';
import { CategoryIcon } from '../../../components/icons';
import { useAppConfig } from '../../../lib/config';
import { QueryState, StatusBadge } from '../../../components/common';
import { primaryLink } from '../components/BrandCommon';
import { CreatorCardView } from './CreatorCardView';
import './CampaignDetailPage.css';

export function CampaignDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const qc = useQueryClient();
  const lang = i18n.language;
  const { paymentsEnabled } = useAppConfig();
  const campaign = useQuery({ queryKey: ['campaigns', id], queryFn: () => api.get<CampaignView>(`/campaigns/${id}`) });
  const shortlist = useQuery({
    queryKey: ['campaigns', id, 'shortlist'],
    queryFn: () => api.get<ShortlistItemView[]>(`/campaigns/${id}/shortlist`),
    enabled: !!campaign.data && campaign.data.status !== 'DRAFT',
  });
  const deals = useQuery({ queryKey: ['deals'], queryFn: () => api.get<DealView[]>('/deals') });
  const checkout = useQuery({
    queryKey: ['checkout', id],
    queryFn: () => api.get<CheckoutView>(`/campaigns/${id}/checkout`),
    enabled: paymentsEnabled && campaign.data?.status === 'PAYMENT_PENDING',
  });
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmSelect, setConfirmSelect] = useState(false);
  const navigate = useNavigate();
  // "Copy campaign": a new draft with the same brief; the wizard opens at the dates step.
  const copy = useMutation({
    mutationFn: () => api.post<{ id: string }>(`/campaigns/${id}/duplicate`),
    onSuccess: (n) => { void qc.invalidateQueries({ queryKey: ['campaigns'] }); navigate(`/brand/campaigns/${n.id}/edit/4`); },
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['campaigns'] });
    void qc.invalidateQueries({ queryKey: ['deals'] });
  };
  const idem = useIdempotencyKey(); // a repeated click or retry selects the creators only once
  const select = useMutation({
    mutationFn: () => api.post(`/campaigns/${id}/shortlist/select`, { itemIds: picked }, { idempotencyKey: idem.keyFor({ itemIds: picked }) }),
    onSuccess: () => {
      idem.renew();
      setPicked([]);
      refresh();
    },
    onError: (e) => setError(errorText(t, e)),
  });
  const cancel = useMutation({
    mutationFn: () => api.post(`/campaigns/${id}/cancel`, { reason }),
    onSuccess: () => {
      setCancelling(false);
      refresh();
    },
    onError: (e) => setError(errorText(t, e)),
  });

  if (campaign.isLoading || campaign.error) return <QueryState isLoading={campaign.isLoading} error={campaign.error} retry={() => campaign.refetch()} />;
  const c = campaign.data!;
  const items = shortlist.data ?? [];
  const total = items.filter((i) => picked.includes(i.id)).reduce((s, i) => s + i.brandPricePaise, 0);
  const myDeals = (deals.data ?? []).filter((d) => d.campaignId === c.id);
  const order = ['SUBMITTED', 'IN_REVIEW', 'SHORTLIST_SENT', 'CREATORS_SELECTED', 'PAYMENT_PENDING', 'ACTIVE', 'COMPLETED'];
  const at = order.indexOf(c.status);

  return (
    <div className="campaign-detail-page space-y-6">
      <Link to="/brand/campaigns" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ArrowLeft className="h-4 w-4" />
        {t('nav.campaigns')}
      </Link>
      <PageHeader title={c.title} subtitle={c.goal ? t(`goal.${c.goal}`) : undefined}
        action={<div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" loading={copy.isPending} onClick={() => copy.mutate()}>{t('campaign.copy')}</Button>
          <StatusBadge kind="campaign" status={c.status} />
        </div>} />
      {copy.error && <Alert tone="red">{errorText(t, copy.error)}</Alert>}

      {c.status === 'PAYMENT_PENDING' && !paymentsEnabled && <Alert tone="blue">{t('campaign.awaitingStart')}</Alert>}
      {c.status === 'PAYMENT_PENDING' && paymentsEnabled && (
        <Card className={checkout.data?.pending ? 'border-info/30 bg-info-soft' : 'border-warning/30 bg-warning-soft'}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Wallet className={cx('h-6 w-6 shrink-0', checkout.data?.pending ? 'text-info' : 'text-warning')} aria-hidden="true" />
              <div>
                <p className="font-semibold text-navy">{checkout.data?.pending ? t('campaign.paymentPending') : t('campaign.paymentDue')}</p>
                {checkout.data && (
                  <p className="text-sm text-ink-muted">
                    {t('payment.total')}: <strong>{formatINR(checkout.data.totalPaise)}</strong>
                  </p>
                )}
              </div>
            </div>
            <Link to={`/brand/campaigns/${c.id}/payment`} className={primaryLink}>
              {checkout.data?.pending ? t('common.view') : t('campaign.payNow')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      )}

      {c.status !== 'CANCELLED' && (
        <Card>
          <Timeline
            items={['SUBMITTED', 'IN_REVIEW', 'SHORTLIST_SENT', 'PAYMENT_PENDING', 'ACTIVE'].map((s) => {
              const idx = order.indexOf(s);
              return {
                label: t(`status.campaign.${s}`),
                state: idx < at ? 'done' : idx === at || (s === 'PAYMENT_PENDING' && c.status === 'CREATORS_SELECTED') ? 'current' : 'todo',
              };
            })}
          />
        </Card>
      )}

      {['SUBMITTED', 'IN_REVIEW'].includes(c.status) && <Alert tone="blue">{t('campaign.waitingShortlist')}</Alert>}
      {error && <Alert tone="red">{error}</Alert>}

      {items.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-bold text-navy">{t('campaign.shortlist')}</h2>
          {c.status === 'SHORTLIST_SENT' && <p className="mb-4 mt-1 text-sm text-ink-muted">{t('campaign.shortlistText')}</p>}
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((i) => (
              <CreatorCardView
                key={i.id}
                i={i}
                selectable={c.status === 'SHORTLIST_SENT' && i.status === 'PROPOSED'}
                picked={picked.includes(i.id)}
                onToggle={() => setPicked((p) => (p.includes(i.id) ? p.filter((x) => x !== i.id) : [...p, i.id]))}
              />
            ))}
          </div>
          {c.status === 'SHORTLIST_SENT' && picked.length > 0 && (
            <div className="sticky bottom-20 z-20 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card bg-navy p-4 text-white shadow-lift lg:bottom-4">
              <p className="font-semibold">{t('campaign.total', { amount: formatINR(total) })}</p>
              <Button variant="accent" loading={select.isPending} onClick={() => setConfirmSelect(true)}>
                {t('campaign.sendOffers', { n: picked.length })}
              </Button>
            </div>
          )}
          {/* Sending offers can't be undone, so the brand confirms first. */}
          <Dialog open={confirmSelect} onClose={() => setConfirmSelect(false)} title={t('campaign.confirmSendTitle', { n: picked.length })}
            footer={<>
              <Button variant="secondary" onClick={() => setConfirmSelect(false)}>{t('common.cancel')}</Button>
              <Button variant="accent" loading={select.isPending} onClick={() => { setConfirmSelect(false); select.mutate(); }}>{t('common.confirm')}</Button>
            </>}>
            <p className="text-sm">{t('campaign.confirmSendText', { amount: formatINR(total) })}</p>
          </Dialog>
        </section>
      )}

      {myDeals.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-xl font-bold text-navy">{t('campaign.deals')}</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">
            {myDeals.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-3">
                  <Avatar name={d.creator?.displayName} size="sm" />
                  <p className="font-semibold text-navy">{d.creator?.displayName}</p>
                </div>
                <div className="flex items-center gap-3">
                  {d.brandPricePaise != null && <span className="font-semibold">{formatINR(d.brandPricePaise)}</span>}
                  <StatusBadge kind="deal" status={d.status} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Card>
        <CardHeader icon={<Megaphone />} title={t('campaign.details')} />
        <p className="whitespace-pre-line leading-relaxed">{c.description}</p>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink-muted">{t('wizard.categories')}</dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {c.filters.categories.map((k) => (
                <Tag key={k} icon={<CategoryIcon k={k} />}>
                  {categoryLabel(k, lang)}
                </Tag>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t('wizard.cities')}</dt>
            <dd className="mt-1 font-medium">{c.filters.cities.map((k) => cityLabel(k, lang)).join(', ') || '—'}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t('wizard.deliverables')}</dt>
            <dd className="mt-1 font-medium">{c.deliverables.map((d) => `${d.quantity}× ${t(`deliverable.${d.type}`)}`).join(', ')}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t('wizard.creatorsNeeded')}</dt>
            <dd className="mt-1 font-medium">{c.creatorsNeeded}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t('wizard.startDate')}</dt>
            <dd className="mt-1 font-medium">
              {formatDate(c.startDate, lang)} – {formatDate(c.endDate, lang)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">{t('wizard.collabType')}</dt>
            <dd className="mt-1 font-medium">{c.collabType ? t(`collab.${c.collabType}`) : '—'}</dd>
          </div>
        </dl>
      </Card>

      {['SUBMITTED', 'IN_REVIEW', 'SHORTLIST_SENT', 'CREATORS_SELECTED', 'PAYMENT_PENDING'].includes(c.status) && (
        <div className="flex justify-end">
          <Button variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setCancelling(true)}>
            {t('campaign.cancel')}
          </Button>
        </div>
      )}
      <Dialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        title={t('campaign.cancel')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelling(false)}>
              {t('common.back')}
            </Button>
            <Button variant="danger" disabled={reason.trim().length < 3} loading={cancel.isPending} onClick={() => cancel.mutate()}>
              {t('common.confirm')}
            </Button>
          </>
        }
      >
        <Field label={t('campaign.cancelReason')}>
          {(fid) => <Textarea id={fid} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      </Dialog>
    </div>
  );
}
