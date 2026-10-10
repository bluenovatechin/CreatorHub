import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, ClipboardCheck, ClipboardList, Clock, Flag, Inbox, Mail, Megaphone, Send, ShieldAlert, UserCheck, Users, Wallet,
} from 'lucide-react';
import { PageHeader, StatCard } from '@bluenova/ui';
import { api, useAdmin } from '../../lib';
import { QState } from '../../components/common';

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
    { key: 'workToReview', label: 'Creator work to review', to: '/deals', icon: <ClipboardCheck />, tone: 'amber' },
    { key: 'applicationsWaiting', label: 'New applications', to: '/campaigns', icon: <Send />, tone: 'blue' },
    { key: 'messagesWaiting', label: 'Unread conversations', to: '/inbox', icon: <Inbox />, tone: 'amber' },
    { key: 'openDisputes', label: 'Open disputes', to: '/trust', icon: <ShieldAlert />, tone: 'amber' },
    { key: 'openReports', label: 'Open reports', to: '/trust?tab=reports', icon: <Flag />, tone: 'amber' },
    { key: 'overdueWork', label: 'Overdue creator work', to: '/deals?status=OVERDUE', icon: <Clock />, tone: 'amber' },
    { key: 'openEnquiries', label: 'Website enquiries', to: '/inbox?tab=enquiries', icon: <Mail />, tone: 'blue' },
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
