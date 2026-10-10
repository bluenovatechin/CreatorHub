/**
 * CREATOR STATUS PAGE (/creator/status)
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Info } from 'lucide-react';
import { Badge, Button, Card, CardHeader, PageHeader, Timeline, cx } from '@bluenova/ui';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { formatDate } from '../../../lib/format';
import { QueryState, SafetyTip, StatusBadge } from '../../../components/common';
import { useProfile, creatorBtn } from '../components/CreatorCommon';
import './CreatorStatusPage.css';

export function CreatorStatusPage() {
  const { t, i18n } = useTranslation();
  const q = useProfile();
  const qc = useQueryClient();
  const { reloadMe } = useAuth();
  const reapply = useMutation({
    mutationFn: () => api.post('/creators/me/reapply'),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['creator'] });
      await reloadMe();
    },
  });

  if (q.isLoading || q.error) return <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />;
  const p = q.data!;
  if (p.status === 'APPROVED') return <Navigate to="/creator" replace />;
  if (p.status === 'DRAFT') return <Navigate to={`/creator/onboarding/${p.onboardingStep}`} replace />;
  const submittedAt = p.statusHistory.filter((h) => h.to === 'SUBMITTED').at(-1)?.at;
  const decision = ['CHANGES_REQUESTED', 'REJECTED'].includes(p.status);

  return (
    <div className="creator-status-page mx-auto max-w-2xl space-y-5">
      <PageHeader title={t('creatorStatus.title')} action={<StatusBadge kind="creator" status={p.status} />} />
      <Card>
        <Timeline
          items={[
            { label: t('creatorStatus.submitted'), state: 'done', note: formatDate(submittedAt, i18n.language) },
            {
              label: t('creatorStatus.review'),
              state: p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW' ? 'current' : 'done',
              note: !decision ? t('creatorStatus.reviewNote') : undefined,
            },
            {
              label: t('creatorStatus.decision'),
              state: p.status === 'REJECTED' ? 'failed' : decision ? 'current' : 'todo',
              note: decision ? t(`status.creator.${p.status}`) : undefined,
            },
          ]}
        />
      </Card>
      {p.status === 'CHANGES_REQUESTED' && (
        <Card className="border-warning/40">
          <CardHeader icon={<Info />} title={t('creatorStatus.changesTitle')} />
          {p.review?.reasonCode && <Badge tone="amber">{t(`reviewReason.${p.review.reasonCode}`)}</Badge>}
          <p className="mt-3 whitespace-pre-line text-ink">{p.review?.reasonText}</p>
          <Link
            to="/creator/onboarding/1"
            className={cx(creatorBtn, 'mt-5 bg-primary text-white shadow-btn hover:bg-primary-hover')}
          >
            {t('creatorStatus.fixNow')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      )}
      {p.status === 'REJECTED' && (
        <Card>
          {p.review?.reasonText && <p className="whitespace-pre-line">{p.review.reasonText}</p>}
          {p.reapplyAfter && new Date(p.reapplyAfter) > new Date() ? (
            <p className="mt-3 text-sm text-ink-muted">
              {t('creatorStatus.rejectedNote', { date: formatDate(p.reapplyAfter, i18n.language) })}
            </p>
          ) : (
            <Button className="mt-4" loading={reapply.isPending} onClick={() => reapply.mutate()}>
              {t('creatorStatus.reapply')}
            </Button>
          )}
        </Card>
      )}
      <SafetyTip kind="otp" />
    </div>
  );
}
