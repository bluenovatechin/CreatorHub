/**
 * EMAIL LOG (/emails, super admins): every notification email (offers, reviews, deadlines, team messages…) with
 * its status: waiting, sent, skipped (person turned emails off) or failed (with the provider's reason).
 * Failed emails can be retried. Shows how many were sent in the last 24 h against the daily limit.
 * Login codes and password emails are not in this list (they are sent directly). API: modules/admin/emails.routes.ts.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, PageHeader, cx } from '@bluenova/ui';
import { api, date, errorText, label } from '../../lib';
import { QState } from '../../components/common';

interface EmailRow {
  id: string; type: string; status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED'; attempts: number; lastError: string | null;
  nextAttemptAt: string; sentAt: string | null; createdAt: string; to: string | null; name: string | null;
}
const TONE = { PENDING: 'blue', SENDING: 'blue', SENT: 'green', FAILED: 'red', SKIPPED: 'grey' } as const;

export function EmailLogPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'ALL';
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['emails', status], queryFn: () => api.getWithMeta<EmailRow[]>(`/admin/emails?limit=50&status=${status}`) });
  const retry = useMutation({
    mutationFn: (id: string) => api.post(`/admin/emails/${id}/retry`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emails'] }),
  });
  const meta = q.data?.meta as { sent24h?: number; dailyLimit?: number; provider?: string } | undefined;
  return (
    <div>
      <PageHeader title="Email log" subtitle="Notification emails and what happened to each one." />
      {meta && (
        <p className="mb-4 text-sm text-ink-muted">
          Sent in the last 24 h: <b>{meta.sent24h}</b> of {meta.dailyLimit} allowed · sending with <b>{meta.provider}</b>
          {meta.provider === 'console' && ' (emails are only printed in the server log)'}
        </p>
      )}
      <div className="mb-5 flex flex-wrap gap-2">
        {['ALL', 'PENDING', 'SENT', 'FAILED', 'SKIPPED'].map((s) => (
          <button key={s} type="button" onClick={() => setParams({ status: s })}
            className={cx('min-h-9 rounded-full px-4 text-sm font-semibold', status === s ? 'bg-primary text-white' : 'border border-line bg-white text-ink-muted hover:text-navy')}>
            {s === 'ALL' ? 'All' : label(s)}
          </button>
        ))}
      </div>
      {retry.error && <div className="mb-3"><Alert tone="red">{errorText(retry.error)}</Alert></div>}
      {q.isLoading || q.error ? <QState q={q} /> : q.data!.data.length === 0 ? <EmptyState icon={<MailCheck />} title="No emails here" /> : (
        <div className="overflow-x-auto rounded-card border border-line bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-ink-muted"><tr><th className="p-3">When</th><th className="p-3">To</th><th className="p-3">About</th><th className="p-3">Status</th><th className="p-3">Details</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-line">
              {q.data!.data.map((e) => (
                <tr key={e.id}>
                  <td className="p-3 whitespace-nowrap">{date(e.createdAt)}</td>
                  <td className="p-3">{e.name}<div className="text-xs text-ink-muted">{e.to ?? '—'}</div></td>
                  <td className="p-3">{label(e.type)}</td>
                  <td className="p-3"><Badge tone={TONE[e.status]}>{label(e.status)}</Badge></td>
                  <td className="p-3 text-xs text-ink-muted">
                    {e.status === 'SENT' ? `Sent ${date(e.sentAt)}` : e.status === 'PENDING' && e.attempts > 0 ? `Try ${e.attempts + 1} at ${date(e.nextAttemptAt)}` : ''}
                    {e.lastError && <div className="text-danger">{e.lastError}</div>}
                  </td>
                  <td className="p-3">{e.status === 'FAILED' && <Button size="sm" variant="secondary" loading={retry.isPending && retry.variables === e.id} onClick={() => retry.mutate(e.id)}>Retry</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
