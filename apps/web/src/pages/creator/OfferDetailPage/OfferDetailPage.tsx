/**
 * OFFER DETAIL PAGE (/creator/offers/:id)
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Clapperboard, Gift, Hash, Info, Megaphone, Wallet,
} from 'lucide-react';
import { OFFER_DECLINE_REASONS } from '@bluenova/shared';
import {
  Alert, Button, Card, CardHeader, Dialog, ExternalLink, Field, Select, Tag, Textarea, useIdempotencyKey } from '@bluenova/ui';
import { api, errorText } from '../../../lib/api';
import { formatDate, formatINR } from '../../../lib/format';
import type { OfferView } from '../../../lib/types';
import { QueryState, SafetyTip, StatusBadge } from '../../../components/common';
import { ReportButton } from '../../../components/ReportButton';
import './OfferDetailPage.css';

export function OfferDetailPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['offers', id], queryFn: () => api.get<OfferView>(`/offers/${id}`) });
  const [confirming, setConfirming] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState<string>('busy');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const idem = useIdempotencyKey(); // a repeated "accept" (double tap, slow network) creates one deal only
  const act = useMutation({
    mutationFn: (action: 'accept' | 'decline') =>
      api.post<OfferView>(`/offers/${id}/${action}`, action === 'decline' ? { reason, note: note || undefined } : {},
        action === 'accept' ? { idempotencyKey: idem.keyFor(id) } : undefined),
    onSuccess: (data) => {
      idem.renew();
      qc.setQueryData(['offers', id], data);
      void qc.invalidateQueries({ queryKey: ['offers'] });
      void qc.invalidateQueries({ queryKey: ['deals'] });
      setConfirming(false);
      setDeclining(false);
    },
    onError: (e) => setError(errorText(t, e)),
  });

  if (q.isLoading || q.error) return <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />;
  const o = q.data!;
  const lang = i18n.language;

  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <div>
        <p className="text-sm font-bold text-navy">{title}</p>
        <ul className="mt-1 space-y-1 text-sm">
          {items.map((x) => (
            <li key={x} className="flex gap-2">
              <span className="text-primary">•</span>{x}
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="offer-detail-page mx-auto max-w-3xl space-y-5">
      <Link to="/creator/offers" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
        <ArrowLeft className="h-4 w-4" />
        {t('offers.title')}
      </Link>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{o.companyName}</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold text-navy">{o.campaign?.title}</h1>
          </div>
          <StatusBadge kind="offer" status={o.status} />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-accent-soft p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-800">
              <Wallet className="h-3.5 w-3.5" />
              {t('offers.payout')}</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-accent">{formatINR(o.payoutPaise)}</p>
          </div>
          <div className="rounded-2xl bg-bg p-4">
            <p className="text-xs font-semibold text-ink-muted">{t('offers.draftDue')}</p>
            <p className="mt-1 font-bold text-navy">{formatDate(o.deadlines.draftDue, lang)}</p>
          </div>
          <div className="rounded-2xl bg-bg p-4">
            <p className="text-xs font-semibold text-ink-muted">{t('offers.liveDue')}</p>
            <p className="mt-1 font-bold text-navy">{formatDate(o.deadlines.liveDue, lang)}</p>
          </div>
        </div>
        {o.campaign?.product && (
          <p className="mt-4 flex items-center gap-2 text-sm">
            <Gift className="h-4 w-4 text-primary" />
            {t('offers.product')}: <strong>{o.campaign.product.name}</strong>
          </p>
        )}
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-primary-50 p-3 text-sm text-navy">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          {t('offers.payoutNote')}
        </p>
      </Card>

      <Card>
        <CardHeader icon={<Megaphone />} title={t('offers.brief')} />
        <p className="whitespace-pre-line leading-relaxed">{o.brief.description}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {o.deliverables.map((d) => (
            <Tag key={d.type} icon={<Clapperboard />}>
              {d.quantity}× {t(`deliverable.${d.type}`)}
            </Tag>
          ))}
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {list(t('offers.dos'), o.brief.dos)}
          {list(t('offers.donts'), o.brief.donts)}
        </div>
        {(o.brief.hashtags.length > 0 || o.brief.mentions.length > 0) && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {o.brief.hashtags.map((h) => (
              <Tag key={h} icon={<Hash />}>
                {h.replace('#', '')}
              </Tag>
            ))}
            {o.brief.mentions.map((m) => (
              <Tag key={m}>{m}</Tag>
            ))}
          </div>
        )}
        {o.brief.referenceUrls.length > 0 && (
          <div className="mt-4 space-y-1">
            {o.brief.referenceUrls.map((u) => (
              <p key={u} className="text-sm">
                <ExternalLink href={u}>{u}</ExternalLink>
              </p>
            ))}
          </div>
        )}
        <div className="mt-5">
          <Alert tone="amber">{t('offers.disclosure')}</Alert>
        </div>
      </Card>

      {o.status === 'ACCEPTED' && <Alert tone="green">{t('offers.accepted')}</Alert>}
      {error && <Alert tone="red">{error}</Alert>}

      {o.status === 'SENT' && (
        <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-card border border-line bg-white p-4 shadow-lift sm:flex-row sm:justify-end lg:bottom-4">
          <Button variant="secondary" size="lg" onClick={() => setDeclining(true)}>
            {t('offers.decline')}
          </Button>
          <Button variant="accent" size="lg" icon={<CheckCircle2 className="h-5 w-5" />} onClick={() => setConfirming(true)}>
            {t('offers.accept')}
          </Button>
        </div>
      )}

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={t('offers.accept')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="accent" loading={act.isPending} onClick={() => act.mutate('accept')}>
              {t('common.confirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed">{t('offers.acceptConfirm')}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t('offers.payoutNote')}</p>
      </Dialog>

      <Dialog
        open={declining}
        onClose={() => setDeclining(false)}
        title={t('offers.declineTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeclining(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={act.isPending} onClick={() => act.mutate('decline')}>
              {t('offers.decline')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('offers.declineTitle')}>
            {(fid) => (
              <Select id={fid} value={reason} onChange={(e) => setReason(e.target.value)}>
                {OFFER_DECLINE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`declineReason.${r}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('offers.note')}>
            {(fid) => <Textarea id={fid} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </div>
      </Dialog>
      <SafetyTip />
      {o.campaign && <ReportButton targetType="CAMPAIGN" targetId={o.campaign.id} />}
    </div>
  );
}
