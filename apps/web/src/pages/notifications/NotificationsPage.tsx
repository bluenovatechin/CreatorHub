/**
 * NOTIFICATIONS PAGE (/creator/notifications, /brand/notifications)
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { Button, EmptyState, PageHeader } from '@bluenova/ui';
import { api } from '../../lib/api';
import type { NotificationView } from '../../lib/types';
import { QueryState } from '../../components/common';
import { NotificationItem } from './NotificationItem';
import './NotificationsPage.css';

export function NotificationsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications', 'list'], queryFn: () => api.getWithMeta<NotificationView[]>('/notifications') });
  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read', { all: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const items = q.data?.data ?? [];
  const unread = Number(q.data?.meta?.unread ?? 0);

  return (
    <div className="notifications-page mx-auto max-w-2xl">
      <PageHeader
        title={t('notifications.title')}
        subtitle={unread ? t('notifications.unread', { n: unread }) : undefined}
        action={
          unread > 0 && (
            <Button variant="secondary" size="sm" loading={markAll.isPending} onClick={() => markAll.mutate()}>
              {t('notifications.markAll')}
            </Button>
          )
        }
      />
      {q.isLoading || q.error ? (
        <QueryState isLoading={q.isLoading} error={q.error} retry={() => q.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Bell />} title={t('notifications.none')} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-white shadow-card">
          {items.map((n) => (
            <NotificationItem key={n.id} n={n} />
          ))}
        </ul>
      )}
    </div>
  );
}
