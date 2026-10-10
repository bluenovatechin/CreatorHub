import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Megaphone } from 'lucide-react';
import { api } from '../../../lib/api';
import { formatDate } from '../../../lib/format';
import type { CampaignView } from '../../../lib/types';
import { StatusBadge } from '../../../components/common';

export const optional = (v: unknown) => (v === '' || v === null ? undefined : v);

export const primaryLink =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-ctl bg-primary px-4 text-sm font-semibold text-white shadow-btn transition hover:bg-primary-hover';

export const useCampaigns = () =>
  useQuery({ queryKey: ['campaigns'], queryFn: () => api.get<CampaignView[]>('/campaigns') });

export function CampaignRow({ c }: { c: CampaignView }) {
  const { t, i18n } = useTranslation();
  const href = c.status === 'DRAFT' ? `/brand/campaigns/${c.id}/edit/${Math.min(6, c.wizardStep)}` : `/brand/campaigns/${c.id}`;

  return (
    <li>
      <Link to={href} className="group flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-primary-50/50">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Megaphone className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-navy">{c.title}</p>
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Calendar className="h-3.5 w-3.5" />
              {c.startDate ? `${formatDate(c.startDate, i18n.language)} – ${formatDate(c.endDate, i18n.language)}` : formatDate(c.createdAt, i18n.language)}
              {c.goal ? ` · ${t(`goal.${c.goal}`)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge kind="campaign" status={c.status} />
          <ArrowRight className="h-4 w-4 text-ink-faint group-hover:text-primary" aria-hidden="true" />
        </div>
      </Link>
    </li>
  );
}
