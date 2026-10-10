import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Clapperboard, Handshake } from 'lucide-react';
import { api } from '../../../lib/api';
import { formatDate, formatINR } from '../../../lib/format';
import type { CreatorSelf, DealView, OfferView } from '../../../lib/types';
import { StatusBadge } from '../../../components/common';

export const useProfile = () =>
  useQuery({ queryKey: ['creator', 'me'], queryFn: () => api.get<CreatorSelf>('/creators/me') });

export const creatorBtn =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-ctl px-4 text-sm font-semibold transition';

export function OfferCard({ o }: { o: OfferView }) {
  const { t, i18n } = useTranslation();
  return (
    <Link
      to={`/creator/offers/${o.id}`}
      className="group block rounded-card border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">{o.companyName}</p>
          <p className="mt-1 font-display font-bold text-navy">{o.campaign?.title}</p>
        </div>
        <StatusBadge kind="offer" status={o.status} />
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-ink-muted">{t('offers.payout')}</p>
          <p className="font-display text-2xl font-extrabold text-accent">{formatINR(o.payoutPaise)}</p>
        </div>
        <ArrowRight className="h-5 w-5 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
      </div>
      {o.status === 'SENT' && (
        <p className="mt-2 text-xs font-semibold text-warning">
          {t('offers.expires', { date: formatDate(o.expiresAt, i18n.language) })}
        </p>
      )}
    </Link>
  );
}

export function DealList({ deals }: { deals: DealView[] }) {
  const { t, i18n } = useTranslation();
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">
      {deals.map((d) => (
        <li key={d.id}>
          <Link to={d.type === 'INTRO_REEL' ? '/creator/intro-reel' : `/creator/deals/${d.id}`}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-primary-50">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              {d.type === 'INTRO_REEL' ? <Clapperboard className="h-5 w-5" /> : <Handshake className="h-5 w-5" />}
            </span>
            <div>
              <p className="font-semibold text-navy">{d.type === 'INTRO_REEL' ? t('dealType.INTRO_REEL') : d.campaignTitle}</p>
              <p className="text-sm text-ink-muted">
                {d.companyName ?? 'Bluenova'}
                {d.deadlines?.liveDue ? ` · ${t('common.due', { date: formatDate(d.deadlines.liveDue, i18n.language) })}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {d.creatorPayoutPaise != null && (
              <span className="font-display font-bold text-accent">{formatINR(d.creatorPayoutPaise)}</span>
            )}
            <StatusBadge kind="deal" status={d.status} />
          </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
