/**
 * OPPORTUNITIES PAGE (/creator/opportunities): open campaigns in the creator's categories. The creator can mark
 * interest, or apply with a pitch (ApplyDialog); "My applications" shows each application's status.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Calendar, CheckCircle2, Clapperboard, MapPin, Send, Sparkles } from 'lucide-react';
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Tag } from '@bluenova/ui';
import { api, errorText } from '../../../lib/api';
import { categoryLabel, cityLabel, formatDate } from '../../../lib/format';
import type { ApplicationView, Opportunity } from '../../../lib/types';
import { ApplyDialog } from './ApplyDialog';
import { CategoryIcon } from '../../../components/icons';
import { QueryState } from '../../../components/common';
import './OpportunitiesPage.css';

export function OpportunitiesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['opportunities'], queryFn: () => api.get<Opportunity[]>('/opportunities') });
  const toggle = useMutation({
    mutationFn: ({ id, interested }: { id: string; interested: boolean }) =>
      api.post(`/opportunities/${id}/interest`, { interested }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opportunities'] }),
  });
  const mine = useQuery({ queryKey: ['applications'], queryFn: () => api.get<ApplicationView[]>('/applications') });
  const withdraw = useMutation({
    mutationFn: (id: string) => api.post(`/applications/${id}/withdraw`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['applications'] });
      void qc.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });
  const [applying, setApplying] = useState<Opportunity | null>(null);
  // "Saved" view: only campaigns the creator marked as interested (or applied to).
  const [savedOnly, setSavedOnly] = useState(false);
  const list = (q.data ?? []).filter((o) => !savedOnly || o.interested || !!o.application);

  return (
    <div className="opportunities-page">
      <PageHeader title={t('opps.title')} subtitle={t('opps.subtitle')}
        action={<Button size="sm" variant={savedOnly ? 'accent' : 'secondary'} aria-pressed={savedOnly} onClick={() => setSavedOnly((v) => !v)}>{t('opps.savedOnly')}</Button>} />
      {q.isLoading || q.error ? (
        <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={<Sparkles />} title={t(savedOnly ? 'opps.noneSaved' : 'opps.none')} text={savedOnly ? undefined : t('opps.noneText')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((o) => (
            <Card key={o.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">{o.companyName}</p>
                  <h2 className="mt-1 font-display text-lg font-bold text-navy">{o.title}</h2>
                </div>
                <Badge tone="blue">{t(`goal.${o.goal}`)}</Badge>
              </div>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted">{o.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {o.categories.map((c) => (
                  <Tag key={c} icon={<CategoryIcon k={c} />}>
                    {categoryLabel(c, i18n.language)}
                  </Tag>
                ))}
                {o.cities.slice(0, 3).map((c) => (
                  <Tag key={c} icon={<MapPin />}>
                    {cityLabel(c, i18n.language)}
                  </Tag>
                ))}
                {o.deliverables.map((d) => (
                  <Tag key={d.type} icon={<Clapperboard />}>
                    {d.quantity}× {t(`deliverable.${d.type}`)}
                  </Tag>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
                <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(o.startDate, i18n.language)} – {formatDate(o.endDate, i18n.language)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                {o.application ? (
                  <Badge tone={o.application.status === 'SHORTLISTED' ? 'green' : o.application.status === 'SUBMITTED' ? 'blue' : 'grey'}>
                    {t(`apply.status.${o.application.status}`)}
                  </Badge>
                ) : (
                  <Button size="sm" icon={<Send className="h-4 w-4" />} onClick={() => setApplying(o)}>{t('apply.button')}</Button>
                )}
                <Button
                  variant={o.interested ? 'accent' : 'secondary'}
                  size="sm"
                  aria-pressed={o.interested}
                  loading={toggle.isPending && toggle.variables?.id === o.id}
                  icon={o.interested ? <CheckCircle2 className="h-4 w-4" /> : undefined}
                  onClick={() => toggle.mutate({ id: o.id, interested: !o.interested })}
                >
                  {o.interested ? t('opps.interested') : t('opps.markInterested')}
                </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {mine.data && mine.data.length > 0 && (
        <Card className="mt-6">
          <CardHeader icon={<Send />} title={t('apply.mine')} />
          <ul className="divide-y divide-line">
            {mine.data.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold text-navy">{a.campaignTitle}</p>
                  <p className="text-xs text-ink-muted">{formatDate(a.createdAt, i18n.language)}</p>
                  {a.decisionNote && <p className="mt-1 text-sm">{a.decisionNote}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={a.status === 'SHORTLISTED' ? 'green' : a.status === 'SUBMITTED' ? 'blue' : 'grey'}>{t(`apply.status.${a.status}`)}</Badge>
                  {a.status === 'SUBMITTED' && (
                    <Button size="sm" variant="secondary" loading={withdraw.isPending && withdraw.variables === a.id} onClick={() => withdraw.mutate(a.id)}>
                      {t('apply.withdraw')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {withdraw.error && <p className="mt-2 text-sm text-danger">{errorText(t, withdraw.error)}</p>}
        </Card>
      )}
      <ApplyDialog opportunity={applying} onClose={() => setApplying(null)} />
    </div>
  );
}
